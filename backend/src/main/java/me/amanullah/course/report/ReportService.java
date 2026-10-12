package me.amanullah.course.report;

import me.amanullah.course.assessment.Assessment;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.assessment.Question;
import me.amanullah.course.assessment.QuestionType;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.learning.ProgressService;
import me.amanullah.course.report.ReportDtos.AssessmentAnalyticsDto;
import me.amanullah.course.report.ReportDtos.Bucket;
import me.amanullah.course.report.ReportDtos.CellStatus;
import me.amanullah.course.report.ReportDtos.ColumnStats;
import me.amanullah.course.report.ReportDtos.CourseRef;
import me.amanullah.course.report.ReportDtos.Funnel;
import me.amanullah.course.report.ReportDtos.GradebookCell;
import me.amanullah.course.report.ReportDtos.GradebookColumn;
import me.amanullah.course.report.ReportDtos.GradebookDto;
import me.amanullah.course.report.ReportDtos.GradebookRow;
import me.amanullah.course.report.ReportDtos.ItemProgressRow;
import me.amanullah.course.report.ReportDtos.Kpis;
import me.amanullah.course.report.ReportDtos.ModuleCompletion;
import me.amanullah.course.report.ReportDtos.ModuleProgress;
import me.amanullah.course.report.ReportDtos.OverviewDto;
import me.amanullah.course.report.ReportDtos.QuestionStats;
import me.amanullah.course.report.ReportDtos.StudentAttempt;
import me.amanullah.course.report.ReportDtos.StudentEnrollment;
import me.amanullah.course.report.ReportDtos.StudentReportDto;
import me.amanullah.course.report.ReportDtos.StudentTotals;
import me.amanullah.course.report.ReportDtos.WrongAnswer;
import me.amanullah.course.report.ReportQueries.AnswerRow;
import me.amanullah.course.report.ReportQueries.AssessmentRow;
import me.amanullah.course.report.ReportQueries.AttemptRow;
import me.amanullah.course.report.ReportQueries.OptionRow;
import me.amanullah.course.report.ReportQueries.ProgressRow;
import me.amanullah.course.report.ReportQueries.SelectionRow;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Instructor reports: course overview, gradebook, learner report and assessment analytics. All of them are read-only
 * and built from a few flat aggregate queries per request. Only the owner of the course (or an admin) may read them;
 * other instructors get a 404.
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

    static final Duration ACTIVE_WINDOW = Duration.ofDays(7);

    private final CourseAccess access;
    private final ContentItemRepository items;
    private final EnrollmentRepository enrollments;
    private final AssessmentRepository assessments;
    private final ProgressService progressService;
    private final ReportQueries queries;
    private final UserMapper userMapper;
    private final Clock clock;

    public ReportService(CourseAccess access, ContentItemRepository items, EnrollmentRepository enrollments,
                         AssessmentRepository assessments, ProgressService progressService, ReportQueries queries,
                         UserMapper userMapper, Clock clock) {
        this.access = access;
        this.items = items;
        this.enrollments = enrollments;
        this.assessments = assessments;
        this.progressService = progressService;
        this.queries = queries;
        this.userMapper = userMapper;
        this.clock = clock;
    }

    // ================================================================== course context

    /** Everything about one course a report needs, loaded with a fixed number of queries. */
    private final class CourseData {
        final Course course;
        final Instant now = Instant.now(clock);
        final List<ContentItem> outline;
        final List<ContentItem> liveItems;
        final Set<UUID> liveIds;
        final List<ContentItem> assessmentItems;
        final Map<UUID, AssessmentRow> assessmentByItem = new HashMap<>();
        final List<AttemptRow> attempts;
        final List<ProgressRow> progress;

        CourseData(Course course, UUID studentId) {
            this.course = course;
            this.outline = items.findOutline(course.getId());
            this.liveItems = progressService.liveItems(List.of(course.getId()), now)
                    .getOrDefault(course.getId(), List.of());
            this.liveIds = liveItems.stream().map(ContentItem::getId).collect(Collectors.toSet());
            queries.assessmentsOfCourse(course.getId()).forEach(a -> assessmentByItem.put(a.itemId(), a));
            this.attempts = studentId == null ? queries.attemptsOfCourse(course.getId())
                    : queries.attemptsOfStudent(course.getId(), studentId);
            this.progress = studentId == null ? queries.progressOfCourse(course.getId())
                    : queries.progressOfStudent(course.getId(), studentId);
            Set<UUID> attempted = attempts.stream().map(AttemptRow::itemId).collect(Collectors.toSet());
            // quizzes/exams that learners can see, plus any that already have attempts (e.g. unpublished later)
            this.assessmentItems = outline.stream()
                    .filter(i -> i.getType().isAssessment() && assessmentByItem.containsKey(i.getId()))
                    .filter(i -> liveIds.contains(i.getId()) || attempted.contains(i.getId()))
                    .toList();
        }

        CourseRef ref() {
            return new CourseRef(course.getId(), course.getSlug(), course.getTitle());
        }

        /** Completed live items per student. */
        Map<UUID, Map<UUID, Instant>> completions() {
            Map<UUID, Map<UUID, Instant>> result = new HashMap<>();
            for (ProgressRow p : progress) {
                if (liveIds.contains(p.itemId())) {
                    result.computeIfAbsent(p.studentId(), k -> new HashMap<>()).put(p.itemId(), p.completedAt());
                }
            }
            return result;
        }

        /** Latest progress or attempt timestamp per student. */
        Map<UUID, Instant> lastActivity() {
            Map<UUID, Instant> result = new HashMap<>();
            progress.forEach(p -> result.merge(p.studentId(), p.completedAt(), ReportService::max));
            for (AttemptRow a : attempts) {
                result.merge(a.studentId(), a.startedAt(), ReportService::max);
                if (a.submittedAt() != null) {
                    result.merge(a.studentId(), a.submittedAt(), ReportService::max);
                }
            }
            return result;
        }

        Map<UUID, Map<UUID, List<AttemptRow>>> attemptsByStudentAndItem() {
            Map<UUID, Map<UUID, List<AttemptRow>>> result = new HashMap<>();
            for (AttemptRow a : attempts) {
                result.computeIfAbsent(a.studentId(), k -> new HashMap<>())
                        .computeIfAbsent(a.itemId(), k -> new ArrayList<>()).add(a);
            }
            return result;
        }

        /** Live modules in outline order with their live items. */
        Map<CourseModule, List<ContentItem>> liveModules() {
            Map<CourseModule, List<ContentItem>> result = new LinkedHashMap<>();
            for (ContentItem i : liveItems) {
                result.computeIfAbsent(i.getModule(), k -> new ArrayList<>()).add(i);
            }
            return result;
        }
    }

    // ================================================================== overview

    public OverviewDto overview(CurrentUser me, UUID courseId) {
        Course course = access.course(courseId, me);
        CourseData d = new CourseData(course, null);
        List<Enrollment> all = enrollments.findByCourse(courseId, null);
        Map<EnrollmentStatus, Long> byStatus = all.stream()
                .collect(Collectors.groupingBy(Enrollment::getStatus, Collectors.counting()));
        List<UUID> learners = all.stream().filter(e -> e.getStatus() == EnrollmentStatus.APPROVED)
                .map(e -> e.getStudent().getId()).toList();
        Set<UUID> learnerSet = new HashSet<>(learners);

        Map<UUID, Map<UUID, Instant>> completions = d.completions();
        int total = d.liveItems.size();
        List<Integer> percents = learners.stream()
                .map(s -> ProgressService.percent(completions.getOrDefault(s, Map.of()).size(), total)).toList();
        int completed = (int) percents.stream().filter(p -> total > 0 && p == 100).count();

        List<Bucket> distribution = List.of(
                new Bucket("0-25", 0, 25, (int) percents.stream().filter(p -> p < 25).count()),
                new Bucket("25-50", 25, 50, (int) percents.stream().filter(p -> p >= 25 && p < 50).count()),
                new Bucket("50-75", 50, 75, (int) percents.stream().filter(p -> p >= 50 && p < 75).count()),
                new Bucket("75-100", 75, 100, (int) percents.stream().filter(p -> p >= 75 && p < 100).count()),
                new Bucket("100", 100, 100, (int) percents.stream().filter(p -> p == 100).count()));

        List<ModuleCompletion> modules = new ArrayList<>();
        d.liveModules().forEach((m, list) -> {
            Double pct = null;
            if (!learners.isEmpty()) {
                double sum = 0;
                for (UUID s : learners) {
                    Map<UUID, Instant> done = completions.getOrDefault(s, Map.of());
                    sum += list.stream().filter(i -> done.containsKey(i.getId())).count() * 100.0 / list.size();
                }
                pct = round1(sum / learners.size());
            }
            modules.add(new ModuleCompletion(m.getId(), m.getTitle(), list.size(), pct));
        });

        // best graded result per learner and assessment
        Set<UUID> assessmentItemIds = d.assessmentItems.stream().map(ContentItem::getId).collect(Collectors.toSet());
        Map<UUID, Map<UUID, List<AttemptRow>>> grouped = d.attemptsByStudentAndItem();
        List<Double> bests = new ArrayList<>();
        int passed = 0;
        for (UUID s : learners) {
            for (Map.Entry<UUID, List<AttemptRow>> e : grouped.getOrDefault(s, Map.of()).entrySet()) {
                if (!assessmentItemIds.contains(e.getKey())) {
                    continue;
                }
                Double best = bestGraded(e.getValue());
                if (best != null) {
                    bests.add(best);
                    if (best >= d.assessmentByItem.get(e.getKey()).passingScore()) {
                        passed++;
                    }
                }
            }
        }
        int pendingGrading = (int) d.attempts.stream().filter(a -> a.status() == AttemptStatus.SUBMITTED).count();
        Instant since = d.now.minus(ACTIVE_WINDOW);
        int active = (int) d.lastActivity().entrySet().stream()
                .filter(e -> learnerSet.contains(e.getKey()) && !e.getValue().isBefore(since)).count();

        Kpis kpis = new Kpis(learners.size(), count(byStatus, EnrollmentStatus.PENDING),
                learners.isEmpty() ? null : round1(percents.stream().mapToInt(Integer::intValue).average().orElse(0)),
                learners.isEmpty() ? null : round1(completed * 100.0 / learners.size()), completed,
                d.assessmentItems.size(), mean(bests), bests.isEmpty() ? null : round1(passed * 100.0 / bests.size()),
                pendingGrading, active, total);
        Funnel funnel = new Funnel(all.size(), count(byStatus, EnrollmentStatus.PENDING),
                count(byStatus, EnrollmentStatus.APPROVED), count(byStatus, EnrollmentStatus.REJECTED),
                count(byStatus, EnrollmentStatus.WITHDRAWN), count(byStatus, EnrollmentStatus.REVOKED));
        return new OverviewDto(d.ref(), d.now, kpis, distribution, modules, funnel);
    }

    // ================================================================== gradebook

    public GradebookDto gradebook(CurrentUser me, UUID courseId) {
        Course course = access.course(courseId, me);
        CourseData d = new CourseData(course, null);
        List<Enrollment> approved = enrollments.findByCourse(courseId, EnrollmentStatus.APPROVED);
        Map<UUID, Map<UUID, Instant>> completions = d.completions();
        Map<UUID, Instant> lastActivity = d.lastActivity();
        Map<UUID, Map<UUID, List<AttemptRow>>> grouped = d.attemptsByStudentAndItem();
        int total = d.liveItems.size();

        List<GradebookRow> rows = new ArrayList<>();
        Map<UUID, List<GradebookCell>> cellsByItem = new HashMap<>();
        for (Enrollment e : approved) {
            User u = e.getStudent();
            Map<UUID, List<AttemptRow>> mine = grouped.getOrDefault(u.getId(), Map.of());
            List<GradebookCell> cells = new ArrayList<>();
            for (ContentItem item : d.assessmentItems) {
                GradebookCell cell = cell(item.getId(), mine.getOrDefault(item.getId(), List.of()),
                        d.assessmentByItem.get(item.getId()));
                cells.add(cell);
                cellsByItem.computeIfAbsent(item.getId(), k -> new ArrayList<>()).add(cell);
            }
            List<Double> bests = cells.stream().map(GradebookCell::bestPercent).filter(Objects::nonNull).toList();
            int done = completions.getOrDefault(u.getId(), Map.of()).size();
            rows.add(new GradebookRow(u.getId(), u.getFullName(), u.getEmail(), userMapper.avatarUrl(u),
                    ProgressService.percent(done, total), done, total, lastActivity.get(u.getId()), mean(bests),
                    bests.size(), cells));
        }
        rows.sort(Comparator.comparing(GradebookRow::fullName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(GradebookRow::email));

        Set<UUID> learnerIds = rows.stream().map(GradebookRow::id).collect(Collectors.toSet());
        List<GradebookColumn> columns = d.assessmentItems.stream().map(item -> {
            AssessmentRow a = d.assessmentByItem.get(item.getId());
            List<GradebookCell> cells = cellsByItem.getOrDefault(item.getId(), List.of());
            List<Double> bests = cells.stream().map(GradebookCell::bestPercent).filter(Objects::nonNull).toList();
            long passedCount = cells.stream().filter(c -> Boolean.TRUE.equals(c.passed())).count();
            int attemptCount = (int) d.attempts.stream()
                    .filter(r -> r.itemId().equals(item.getId()) && r.submitted() && learnerIds.contains(r.studentId()))
                    .count();
            int pending = (int) cells.stream().filter(c -> c.status() == CellStatus.SUBMITTED_PENDING).count();
            ColumnStats stats = new ColumnStats(bests.size(), mean(bests), median(bests),
                    bests.stream().min(Double::compare).orElse(null), bests.stream().max(Double::compare).orElse(null),
                    bests.isEmpty() ? null : round1(passedCount * 100.0 / bests.size()), attemptCount, pending);
            return new GradebookColumn(item.getId(), item.getTitle(), item.getType(), a.totalPoints(),
                    a.passingScore(), stats);
        }).toList();
        return new GradebookDto(d.ref(), d.now, total, columns, rows);
    }

    private static GradebookCell cell(UUID itemId, List<AttemptRow> attempts, AssessmentRow assessment) {
        if (attempts.isEmpty()) {
            return new GradebookCell(itemId, null, null, 0, null, CellStatus.NOT_STARTED, null, null);
        }
        List<AttemptRow> sorted = new ArrayList<>(attempts);
        sorted.sort(Comparator.comparing(AttemptRow::startedAt));
        AttemptRow best = null;
        for (AttemptRow a : sorted) {
            if (a.status() == AttemptStatus.GRADED && (best == null || a.percent() > best.percent())) {
                best = a;
            }
        }
        AttemptRow pending = sorted.stream().filter(a -> a.status() == AttemptStatus.SUBMITTED)
                .reduce((x, y) -> y).orElse(null);
        AttemptRow lastSubmitted = sorted.stream().filter(AttemptRow::submitted).reduce((x, y) -> y).orElse(null);
        AttemptRow latest = sorted.getLast();
        CellStatus status;
        UUID open;
        if (pending != null) {
            status = CellStatus.SUBMITTED_PENDING;
            open = pending.id();
        } else if (best != null) {
            status = CellStatus.GRADED;
            open = best.id();
        } else {
            status = CellStatus.IN_PROGRESS; // no submitted attempt yet
            open = latest.id();
        }
        int submittedCount = (int) sorted.stream().filter(AttemptRow::submitted).count();
        Double bestPercent = best == null ? null : best.percent();
        Boolean passed = bestPercent == null ? null : bestPercent >= assessment.passingScore();
        return new GradebookCell(itemId, bestPercent, best == null ? null : best.score(), submittedCount, passed,
                status, open, lastSubmitted == null ? null : lastSubmitted.submittedAt());
    }

    /** Best percent of the graded attempts, {@code null} when none is graded. */
    private static Double bestGraded(List<AttemptRow> attempts) {
        return attempts.stream().filter(a -> a.status() == AttemptStatus.GRADED).map(AttemptRow::percent)
                .max(Double::compare).orElse(null);
    }

    // ================================================================== learner report

    public StudentReportDto student(CurrentUser me, UUID courseId, UUID studentId) {
        Course course = access.course(courseId, me);
        Enrollment enrollment = enrollments.findByCourseIdAndStudentId(courseId, studentId)
                .orElseThrow(() -> NotFoundException.of("Enrollment"));
        User student = enrollment.getStudent();
        CourseData d = new CourseData(course, studentId);
        Map<UUID, Instant> done = d.completions().getOrDefault(studentId, Map.of());

        List<ModuleProgress> modules = new ArrayList<>();
        d.liveModules().forEach((m, list) -> {
            List<ItemProgressRow> rows = list.stream()
                    .map(i -> new ItemProgressRow(i.getId(), i.getTitle(), i.getType(), done.get(i.getId()))).toList();
            int c = (int) rows.stream().filter(r -> r.completedAt() != null).count();
            modules.add(new ModuleProgress(m.getId(), m.getTitle(), c, list.size(),
                    ProgressService.percent(c, list.size()), rows));
        });

        Map<UUID, ContentItem> byId = new HashMap<>();
        d.outline.forEach(i -> byId.put(i.getId(), i));
        List<StudentAttempt> attempts = d.attempts.stream().map(a -> {
            ContentItem item = byId.get(a.itemId());
            return new StudentAttempt(a.id(), a.itemId(), item == null ? null : item.getTitle(),
                    item == null ? null : item.getType(), a.status(), a.startedAt(), a.submittedAt(),
                    a.submitted() ? a.score() : null, a.maxScore(), a.percent(), a.passed(), a.late(),
                    a.autoSubmitted(), a.status() == AttemptStatus.SUBMITTED);
        }).toList();

        Map<UUID, List<AttemptRow>> byItem = d.attempts.stream()
                .collect(Collectors.groupingBy(AttemptRow::itemId));
        List<Double> bests = new ArrayList<>();
        int passed = 0;
        for (Map.Entry<UUID, List<AttemptRow>> e : byItem.entrySet()) {
            Double best = bestGraded(e.getValue());
            AssessmentRow a = d.assessmentByItem.get(e.getKey());
            if (best != null) {
                bests.add(best);
                if (a != null && best >= a.passingScore()) {
                    passed++;
                }
            }
        }
        int pending = (int) d.attempts.stream().filter(a -> a.status() == AttemptStatus.SUBMITTED).count();
        StudentTotals totals = new StudentTotals((int) d.attempts.stream().filter(AttemptRow::submitted).count(),
                byItem.size(), passed, d.assessmentItems.size(), mean(bests), pending);

        Instant last = d.lastActivity().get(studentId);
        return new StudentReportDto(d.ref(), d.now, userMapper.toSummary(student),
                new StudentEnrollment(enrollment.getId(), enrollment.getStatus(), enrollment.getAppliedAt(),
                        enrollment.getDecidedAt()),
                ProgressService.percent(done.size(), d.liveItems.size()), done.size(), d.liveItems.size(), last,
                modules, attempts, totals, (int) queries.feedbackCount(courseId, studentId));
    }

    // ================================================================== assessment analytics

    public AssessmentAnalyticsDto assessment(CurrentUser me, UUID itemId) {
        ContentItem item = access.item(itemId, me);
        Assessment assessment = assessments.findByItemId(item.getId())
                .orElseThrow(() -> NotFoundException.of("Assessment"));
        Course course = item.getModule().getCourse();
        Instant now = Instant.now(clock);

        List<AttemptRow> all = queries.attemptsOfAssessment(assessment.getId());
        List<AttemptRow> submitted = all.stream().filter(AttemptRow::submitted).toList();
        List<AttemptRow> graded = submitted.stream().filter(a -> a.status() == AttemptStatus.GRADED).toList();
        List<Double> percents = graded.stream().map(AttemptRow::percent).toList();
        List<Double> scores = graded.stream().map(a -> a.score() == null ? 0.0 : a.score()).toList();
        long passedCount = graded.stream().filter(a -> Boolean.TRUE.equals(a.passed())).count();
        List<Double> durations = submitted.stream().filter(a -> a.submittedAt() != null)
                .map(a -> (double) Duration.between(a.startedAt(), a.submittedAt()).toSeconds())
                .filter(s -> s >= 0).toList();

        List<Bucket> distribution = new ArrayList<>();
        for (int b = 0; b < 10; b++) {
            int from = b * 10;
            int to = from + 10;
            int n = (int) percents.stream()
                    .filter(p -> p >= from && (p < to || (to == 100 && p <= 100))).count();
            distribution.add(new Bucket(from + "-" + to, from, to, n));
        }

        int totalPoints = assessment.totalPoints();
        return new AssessmentAnalyticsDto(item.getId(), item.getTitle(), item.getType(),
                new CourseRef(course.getId(), course.getSlug(), course.getTitle()), now, totalPoints,
                assessment.getPassingScore(), submitted.size(),
                (int) submitted.stream().map(AttemptRow::studentId).distinct().count(), graded.size(),
                submitted.size() - graded.size(),
                (int) all.stream().filter(a -> a.status() == AttemptStatus.IN_PROGRESS).count(),
                mean(percents), median(percents), mean(scores),
                graded.isEmpty() ? null : round1(passedCount * 100.0 / graded.size()), mean(durations),
                distribution, questionStats(assessment));
    }

    private List<QuestionStats> questionStats(Assessment assessment) {
        List<AnswerRow> answers = queries.answersOfAssessment(assessment.getId());
        Map<UUID, Set<UUID>> selections = new HashMap<>();
        for (SelectionRow s : queries.selectionsOfAssessment(assessment.getId())) {
            selections.computeIfAbsent(s.answerId(), k -> new HashSet<>()).add(s.optionId());
        }
        Map<UUID, OptionRow> options = new HashMap<>();
        queries.optionsOfAssessment(assessment.getId()).forEach(o -> options.putIfAbsent(o.optionId(), o));

        // questions in the current order, then questions that only exist in older attempts
        Map<UUID, List<AnswerRow>> byQuestion = answers.stream().collect(Collectors.groupingBy(AnswerRow::questionId));
        record Meta(UUID id, String prompt, QuestionType type, int points, int position) {
        }
        List<Meta> metas = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        int pos = 0;
        for (Question q : assessment.getQuestions()) {
            metas.add(new Meta(q.getId(), q.getPrompt(), q.getType(), q.getPoints(), pos++));
            seen.add(q.getId());
        }
        List<AnswerRow> orphans = byQuestion.entrySet().stream().filter(e -> !seen.contains(e.getKey()))
                .map(e -> e.getValue().getFirst()).sorted(Comparator.comparingInt(AnswerRow::position)).toList();
        for (AnswerRow a : orphans) {
            metas.add(new Meta(a.questionId(), a.prompt(), a.type(), a.points(), pos++));
        }

        List<QuestionStats> result = new ArrayList<>();
        for (Meta m : metas) {
            List<AnswerRow> list = byQuestion.getOrDefault(m.id(), List.of());
            int unanswered = 0;
            int evaluated = 0;
            int correct = 0;
            List<Double> points = new ArrayList<>();
            Map<String, Integer> wrong = new LinkedHashMap<>();
            for (AnswerRow a : list) {
                Set<UUID> selected = selections.getOrDefault(a.answerId(), Set.of());
                boolean blank = selected.isEmpty() && (a.textAnswer() == null || a.textAnswer().isBlank());
                if (blank) {
                    unanswered++;
                }
                if (a.correct() != null) {
                    evaluated++;
                    if (a.correct()) {
                        correct++;
                    }
                }
                if (a.pointsAwarded() != null) {
                    points.add(a.pointsAwarded());
                }
                if (blank || Boolean.TRUE.equals(a.correct())) {
                    continue;
                }
                if (m.type().isChoice()) {
                    for (UUID id : selected) {
                        OptionRow o = options.get(id);
                        if (o != null && !o.correct()) {
                            wrong.merge(o.text(), 1, Integer::sum);
                        }
                    }
                } else if (m.type().isText() && Boolean.FALSE.equals(a.correct())) {
                    wrong.merge(a.textAnswer().strip().toLowerCase(Locale.ROOT), 1, Integer::sum);
                }
            }
            List<WrongAnswer> common = wrong.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(3).map(e -> new WrongAnswer(e.getKey(), e.getValue())).toList();
            result.add(new QuestionStats(m.id(), m.position() + 1, plain(m.prompt()), m.type(), m.points(),
                    list.size() - unanswered, unanswered,
                    evaluated == 0 ? null : round1(correct * 100.0 / evaluated), mean(points), common));
        }
        return result;
    }

    /** Plain text of a question prompt (HTML removed), shortened for tables. */
    static String plain(String html) {
        String text = HtmlSanitizer.toPlainText(html).strip();
        return text.length() > 300 ? text.substring(0, 299) + "…" : text;
    }

    // ================================================================== helpers

    static Double mean(Collection<Double> values) {
        return values.isEmpty() ? null
                : round1(values.stream().mapToDouble(Double::doubleValue).average().orElse(0));
    }

    static Double median(Collection<Double> values) {
        if (values.isEmpty()) {
            return null;
        }
        List<Double> sorted = values.stream().sorted().toList();
        int n = sorted.size();
        double m = n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
        return round1(m);
    }

    static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static int count(Map<EnrollmentStatus, Long> byStatus, EnrollmentStatus s) {
        return byStatus.getOrDefault(s, 0L).intValue();
    }

    private static Instant max(Instant a, Instant b) {
        return a.isAfter(b) ? a : b;
    }
}
