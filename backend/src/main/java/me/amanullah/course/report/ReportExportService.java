package me.amanullah.course.report;

import me.amanullah.course.assessment.Assessment;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assessment.Question;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.common.util.SlugGenerator;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.report.ReportDtos.GradebookCell;
import me.amanullah.course.report.ReportDtos.GradebookColumn;
import me.amanullah.course.report.ReportDtos.GradebookDto;
import me.amanullah.course.report.ReportDtos.GradebookRow;
import me.amanullah.course.report.ReportDtos.ItemProgressRow;
import me.amanullah.course.report.ReportDtos.ModuleProgress;
import me.amanullah.course.report.ReportDtos.StudentAttempt;
import me.amanullah.course.report.ReportDtos.StudentReportDto;
import me.amanullah.course.report.ReportQueries.AttemptRow;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** CSV exports of the instructor reports; headers and labels follow the request locale ({@code Accept-Language}). */
@Service
@Transactional(readOnly = true)
public class ReportExportService {

    public record CsvFile(String fileName, byte[] content) {
    }

    private final ReportService reports;
    private final ReportQueries queries;
    private final CourseAccess access;
    private final AssessmentRepository assessments;
    private final UserRepository users;
    private final Messages messages;
    private final Clock clock;

    public ReportExportService(ReportService reports, ReportQueries queries, CourseAccess access,
                               AssessmentRepository assessments, UserRepository users, Messages messages, Clock clock) {
        this.reports = reports;
        this.queries = queries;
        this.access = access;
        this.assessments = assessments;
        this.users = users;
        this.messages = messages;
        this.clock = clock;
    }

    public CsvFile gradebook(CurrentUser me, UUID courseId) {
        GradebookDto g = reports.gradebook(me, courseId);
        List<Object> header = new ArrayList<>(List.of(h("name"), h("email"), h("progress"), h("completedItems"),
                h("lastActivity"), h("average")));
        for (GradebookColumn c : g.columns()) {
            header.add(c.title() + " (%)");
            header.add(c.title() + " – " + h("status"));
            header.add(c.title() + " – " + h("attempts"));
        }
        Csv csv = new Csv().row(header);
        for (GradebookRow r : g.rows()) {
            List<Object> row = new ArrayList<>(List.of(r.fullName(), r.email(), r.progressPercent(),
                    r.completedItems() + "/" + r.totalLiveItems()));
            row.add(r.lastActivityAt());
            row.add(r.averagePercent());
            for (GradebookCell cell : r.cells()) {
                row.add(cell.bestPercent());
                row.add(messages.get("report.cellStatus." + cell.status().name()));
                row.add(cell.attempts());
            }
            csv.row(row);
        }
        return new CsvFile(fileName("gradebook", g.course().slug()), csv.toBytes());
    }

    public CsvFile attempts(CurrentUser me, UUID itemId) {
        ContentItem item = access.item(itemId, me);
        Assessment assessment = assessments.findByItemId(item.getId())
                .orElseThrow(() -> NotFoundException.of("Assessment"));
        List<AttemptRow> attempts = queries.attemptsOfAssessment(assessment.getId());
        Map<UUID, User> students = users.findAllById(attempts.stream().map(AttemptRow::studentId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Map<UUID, Double>> points = new HashMap<>();
        for (Object[] r : queries.pointsOfAssessment(assessment.getId())) {
            if (r[2] != null) {
                points.computeIfAbsent((UUID) r[0], k -> new HashMap<>()).put((UUID) r[1],
                        ((Number) r[2]).doubleValue());
            }
        }
        // columns: current questions, then questions that only exist in older attempts
        Map<UUID, String> questionHeaders = new LinkedHashMap<>();
        int n = 1;
        for (Question q : assessment.getQuestions()) {
            questionHeaders.put(q.getId(), h("question", n++, q.getPoints()) + " " + ReportService.plain(q.getPrompt()));
        }
        for (Map<UUID, Double> byQuestion : points.values()) {
            for (UUID qid : byQuestion.keySet()) {
                if (!questionHeaders.containsKey(qid)) {
                    questionHeaders.put(qid, h("removedQuestion", n++));
                }
            }
        }

        List<Object> header = new ArrayList<>(List.of(h("name"), h("email"), h("attempt"), h("status"), h("startedAt"),
                h("submittedAt"), h("durationMinutes"), h("score"), h("maxScore"), h("percent"), h("passed"),
                h("late"), h("autoSubmitted")));
        header.addAll(questionHeaders.values());
        Csv csv = new Csv().row(header);
        Map<UUID, Integer> attemptNumber = new HashMap<>();
        for (AttemptRow a : attempts) {
            User u = students.get(a.studentId());
            int number = attemptNumber.merge(a.studentId(), 1, Integer::sum);
            Double minutes = a.submittedAt() == null ? null
                    : Duration.between(a.startedAt(), a.submittedAt()).toSeconds() / 60.0;
            List<Object> row = new ArrayList<>();
            row.add(u == null ? "" : u.getFullName());
            row.add(u == null ? "" : u.getEmail());
            row.add(number);
            row.add(messages.get("report.attemptStatus." + a.status().name()));
            row.add(a.startedAt());
            row.add(a.submittedAt());
            row.add(minutes);
            row.add(a.submitted() ? (Object) (a.score() == null ? 0.0 : a.score()) : null);
            row.add(a.maxScore());
            row.add(a.percent());
            row.add(yesNo(a.passed()));
            row.add(yesNo(a.late()));
            row.add(yesNo(a.autoSubmitted()));
            Map<UUID, Double> mine = points.getOrDefault(a.id(), Map.of());
            for (UUID qid : questionHeaders.keySet()) {
                row.add(a.submitted() ? mine.get(qid) : null);
            }
            csv.row(row);
        }
        String course = item.getModule().getCourse().getSlug();
        return new CsvFile(fileName("attempts", course + "-" + SlugGenerator.slugify(item.getTitle())), csv.toBytes());
    }

    public CsvFile student(CurrentUser me, UUID courseId, UUID studentId) {
        StudentReportDto r = reports.student(me, courseId, studentId);
        Csv csv = new Csv().row(h("section"), h("module"), h("item"), h("itemType"), h("completedAt"), h("status"),
                h("startedAt"), h("submittedAt"), h("score"), h("maxScore"), h("percent"), h("passed"), h("late"),
                h("autoSubmitted"));
        csv.row(h("section.learner"), r.student().fullName(), r.student().email(), null, null,
                messages.get("report.enrollmentStatus." + r.enrollment().status().name()), r.enrollment().appliedAt(),
                r.enrollment().decidedAt(), null, null, r.progressPercent(), null, null, null);
        for (ModuleProgress m : r.modules()) {
            for (ItemProgressRow i : m.items()) {
                csv.row(h("section.progress"), m.title(), i.title(), i.type(), i.completedAt(),
                        messages.get(i.completedAt() == null ? "report.csv.open" : "report.csv.done"),
                        null, null, null, null, null, null, null, null);
            }
        }
        for (StudentAttempt a : r.attempts()) {
            csv.row(h("section.attempt"), null, a.itemTitle(), a.itemType(), null,
                    messages.get("report.attemptStatus." + a.status().name()), a.startedAt(), a.submittedAt(),
                    a.score(), a.maxScore(), a.percent(), yesNo(a.passed()), yesNo(a.late()), yesNo(a.autoSubmitted()));
        }
        String name = SlugGenerator.slugify(r.student().fullName());
        return new CsvFile(fileName("learner", r.course().slug() + "-" + name), csv.toBytes());
    }

    private String h(String key, Object... args) {
        return messages.get("report.csv." + key, args);
    }

    private String yesNo(Boolean value) {
        return value == null ? null : messages.get(value ? "report.csv.yes" : "report.csv.no");
    }

    private String fileName(String kind, String slug) {
        return kind + "-" + slug + "-" + LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC) + ".csv";
    }
}
