package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.AttemptResultDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSessionDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSummaryDto;
import me.amanullah.course.assessment.AssessmentDtos.Grade;
import me.amanullah.course.assessment.AssessmentDtos.SubmittedAnswer;
import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.MessageRef;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaRepository;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Taking, submitting and grading attempts. */
@Service
public class AttemptService {

    private final AssessmentRepository assessments;
    private final AttemptRepository attempts;
    private final UserRepository users;
    private final LearnerAccess learnerAccess;
    private final CourseAccess courseAccess;
    private final AttemptMapper mapper;
    private final NotificationService notifications;
    private final EmailTemplates templates;
    private final AttemptFinalizer finalizer;
    private final Clock clock;
    private final MediaRepository mediaAssets;

    /** Largest accepted recording. */
    static final long MAX_RECORDING_BYTES = 25L * 1024 * 1024;

    public AttemptService(AssessmentRepository assessments, AttemptRepository attempts, UserRepository users,
                          LearnerAccess learnerAccess, CourseAccess courseAccess, AttemptMapper mapper,
                          NotificationService notifications, EmailTemplates templates, AttemptFinalizer finalizer,
                          Clock clock, MediaRepository mediaAssets) {
        this.mediaAssets = mediaAssets;
        this.assessments = assessments;
        this.attempts = attempts;
        this.users = users;
        this.learnerAccess = learnerAccess;
        this.courseAccess = courseAccess;
        this.mapper = mapper;
        this.notifications = notifications;
        this.templates = templates;
        this.finalizer = finalizer;
        this.clock = clock;
    }

    // ---------------- learner ----------------

    @Transactional
    public List<AttemptSummaryDto> myAttempts(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = learnerAccess.item(itemId, me, now);
        Assessment a = requireAssessment(item);
        List<Attempt> mine = attempts.findByAssessmentAndStudent(a.getId(), me.id());
        finalizer.finalizeExpired(mine, now);
        return mine.stream().map(mapper::toSummary).toList();
    }

    /**
     * Starts a new attempt or resumes the one in progress. An in-progress attempt whose time is up is never resumed:
     * it is submitted with its saved answers first (in its own transaction, so that sticks even when starting a new
     * attempt is refused), then a new attempt starts if the rules allow it.
     */
    @Transactional
    public AttemptSessionDto start(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = learnerAccess.item(itemId, me, now);
        Assessment a = requireAssessment(item);
        finalizer.finalizeExpiredInNewTransaction(a.getId(), me.id(), now);
        var inProgress = attempts.findFirstByAssessmentIdAndStudentIdAndStatus(a.getId(), me.id(), AttemptStatus.IN_PROGRESS);
        if (inProgress.isPresent()) {
            if (!finalizer.finalizeIfExpired(inProgress.get(), now)) {
                return mapper.toSession(inProgress.get(), now);
            }
            attempts.flush();
        }
        if (a.getAvailableFrom() != null && now.isBefore(a.getAvailableFrom())) {
            throw new ForbiddenException("ASSESSMENT_NOT_AVAILABLE", "This assessment is not open yet")
                    .key("error.ASSESSMENT_NOT_AVAILABLE.notYet");
        }
        if (a.getAvailableUntil() != null && !now.isBefore(a.getAvailableUntil())) {
            throw new ForbiddenException("ASSESSMENT_NOT_AVAILABLE", "This assessment is closed").key("error.ASSESSMENT_NOT_AVAILABLE.closed");
        }
        if (a.getQuestions().isEmpty()) {
            throw new BadRequestException("NO_QUESTIONS", "This assessment has no questions yet");
        }
        if (a.getMaxAttempts() > 0 && attempts.countByAssessmentIdAndStudentId(a.getId(), me.id()) >= a.getMaxAttempts()) {
            throw new ConflictException("MAX_ATTEMPTS_REACHED", "You have used all attempts for this assessment");
        }
        Instant deadline = a.getTimeLimitMinutes() == null ? null : now.plus(Duration.ofMinutes(a.getTimeLimitMinutes()));
        if (deadline != null && a.getAvailableUntil() != null && deadline.isAfter(a.getAvailableUntil())) {
            deadline = a.getAvailableUntil();
        }
        User student = users.getReferenceById(me.id());
        Attempt attempt = new Attempt(a, student, now, deadline);
        List<Question> questions = new ArrayList<>(a.getQuestions());
        questions.sort(java.util.Comparator.comparingInt(Question::getPosition));
        if (a.isShuffleQuestions()) {
            Collections.shuffle(questions);
        }
        for (int i = 0; i < questions.size(); i++) {
            attempt.getAnswers().add(AttemptAnswer.snapshotOf(attempt, questions.get(i), i));
        }
        attempt.setMaxScore(questions.stream().mapToInt(Question::getPoints).sum());
        attempts.save(attempt);
        return mapper.toSession(attempt, now);
    }

    /**
     * Autosave: stores draft answers on the attempt without grading. Unknown question ids are ignored (as on
     * submit); selected option ids that do not belong to the question are dropped. After the deadline + grace the
     * attempt is submitted with the drafts saved before and 409 {@code ATTEMPT_EXPIRED} is returned (the
     * finalization is committed).
     */
    @Transactional(noRollbackFor = AttemptExpiredException.class)
    public void saveAnswers(CurrentUser me, UUID attemptId, List<SubmittedAnswer> drafts) {
        Attempt attempt = requireOwnAttempt(me, attemptId);
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw alreadySubmitted();
        }
        if (finalizer.finalizeIfExpired(attempt, Instant.now(clock))) {
            throw new AttemptExpiredException();
        }
        applyAnswers(attempt, drafts, false);
    }

    /**
     * Submits an attempt. After the deadline + grace the payload is ignored: the attempt is submitted with the
     * answers autosaved before the deadline and the result has {@code autoSubmitted=true}.
     */
    @Transactional
    public AttemptResultDto submit(CurrentUser me, UUID attemptId, List<SubmittedAnswer> submitted) {
        Attempt attempt = requireOwnAttempt(me, attemptId);
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw alreadySubmitted();
        }
        Instant now = Instant.now(clock);
        if (!finalizer.finalizeIfExpired(attempt, now)) {
            applyAnswers(attempt, submitted, true);
            finalizer.complete(attempt, now, false, false);
        }
        return mapper.toResult(attempt, attempt.getAssessment().isShowCorrectAnswers());
    }

    /**
     * Copies answers onto the attempt's answer rows. With {@code replaceAll}, questions missing from the list are
     * cleared (a submission is the complete answer sheet); otherwise only the listed questions change. Structured
     * responses are reduced to what belongs to the question (unknown blanks and option ids are dropped); a recording
     * must be the learner's own audio upload (400 otherwise).
     */
    private void applyAnswers(Attempt attempt, List<SubmittedAnswer> given, boolean replaceAll) {
        Map<UUID, SubmittedAnswer> byQuestion = new HashMap<>();
        Map<UUID, Integer> indexOf = new HashMap<>();
        if (given != null) {
            for (int i = 0; i < given.size(); i++) {
                byQuestion.put(given.get(i).questionId(), given.get(i));
                indexOf.put(given.get(i).questionId(), i);
            }
        }
        for (AttemptAnswer answer : attempt.getAnswers()) {
            SubmittedAnswer s = byQuestion.get(answer.getQuestionId());
            if (s == null && !replaceAll) {
                continue;
            }
            Set<UUID> valid = new HashSet<>();
            answer.getOptions().forEach(o -> valid.add(o.getOptionId()));
            Set<UUID> selected = new HashSet<>();
            if (s != null && s.selectedOptionIds() != null) {
                s.selectedOptionIds().stream().filter(valid::contains).forEach(selected::add);
            }
            answer.setSelectedOptionIds(selected);
            answer.setTextAnswer(s == null || s.textAnswer() == null || s.textAnswer().isBlank() ? null : s.textAnswer());
            answer.setResponseJson(s == null ? null : cleanResponse(answer, s).toJson());
            if (answer.getQuestionType() == QuestionType.SPEAKING) {
                answer.setResponseMedia(s == null || s.responseMediaId() == null ? null
                        : requireRecording(answer, s.responseMediaId(), attempt.getStudent().getId(),
                        "answers[" + indexOf.get(answer.getQuestionId()) + "].responseMediaId"));
            }
        }
    }

    /** Keeps only the part of a structured response that fits the question snapshot. */
    static AnswerResponse cleanResponse(AttemptAnswer answer, SubmittedAnswer s) {
        Set<String> optionIds = new HashSet<>();
        answer.getOptions().forEach(o -> optionIds.add(o.getOptionId().toString()));
        switch (answer.getQuestionType()) {
            case CLOZE -> {
                Set<String> blanks = new HashSet<>();
                answer.getBlankAnswers().keySet().forEach(i -> blanks.add(String.valueOf(i)));
                Map<String, String> out = new LinkedHashMap<>();
                if (s.blanks() != null) {
                    s.blanks().forEach((k, v) -> {
                        if (blanks.contains(k) && v != null && !v.isBlank()) {
                            out.put(k, v.strip());
                        }
                    });
                }
                return new AnswerResponse(out, null, null);
            }
            case WORD_BANK -> {
                Set<String> blanks = new HashSet<>();
                answer.getOptions().forEach(o -> {
                    if (o.getBlankIndex() != null) {
                        blanks.add(String.valueOf(o.getBlankIndex()));
                    }
                });
                Map<String, String> out = new LinkedHashMap<>();
                if (s.blanks() != null) {
                    s.blanks().forEach((k, v) -> {
                        if (blanks.contains(k) && v != null && optionIds.contains(v)) {
                            out.put(k, v);
                        }
                    });
                }
                return new AnswerResponse(out, null, null);
            }
            case MATCHING -> {
                Map<String, String> out = new LinkedHashMap<>();
                if (s.pairs() != null) {
                    s.pairs().forEach((k, v) -> {
                        if (optionIds.contains(k) && v != null && optionIds.contains(v)) {
                            out.put(k, v);
                        }
                    });
                }
                return new AnswerResponse(null, out, null);
            }
            case ORDERING -> {
                List<String> out = new ArrayList<>();
                if (s.order() != null) {
                    s.order().stream().filter(optionIds::contains).distinct().forEach(out::add);
                }
                return new AnswerResponse(null, null, out);
            }
            default -> {
                return AnswerResponse.EMPTY;
            }
        }
    }

    private MediaAsset requireRecording(AttemptAnswer answer, UUID mediaId, UUID studentId, String field) {
        if (answer.getResponseMedia() != null && answer.getResponseMedia().getId().equals(mediaId)) {
            return answer.getResponseMedia();
        }
        MediaAsset media = mediaAssets.findById(mediaId).orElse(null);
        if (media == null || !media.getOwner().getId().equals(studentId) || media.getKind() != MediaKind.AUDIO
                || media.getSizeBytes() > MAX_RECORDING_BYTES) {
            throw ValidationException.field(field, "question.invalid.responseMedia");
        }
        return media;
    }

    private Attempt requireOwnAttempt(CurrentUser me, UUID attemptId) {
        Attempt attempt = attempts.findWithContext(attemptId).orElseThrow(() -> NotFoundException.of("Attempt"));
        if (!attempt.getStudent().getId().equals(me.id())) {
            throw NotFoundException.of("Attempt");
        }
        return attempt;
    }

    private static ConflictException alreadySubmitted() {
        return new ConflictException("ATTEMPT_ALREADY_SUBMITTED", "This attempt has already been submitted");
    }

    @Transactional
    public AttemptResultDto myResult(CurrentUser me, UUID attemptId) {
        Attempt attempt = requireOwnAttempt(me, attemptId);
        finalizer.finalizeIfExpired(attempt, Instant.now(clock));
        return mapper.toResult(attempt, attempt.getAssessment().isShowCorrectAnswers());
    }

    // ---------------- instructor ----------------

    @Transactional
    public List<AttemptSummaryDto> attemptsForItem(CurrentUser me, UUID itemId) {
        ContentItem item = courseAccess.item(itemId, me);
        Instant now = Instant.now(clock);
        return assessments.findByItemId(item.getId())
                .map(a -> {
                    List<Attempt> list = attempts.findByAssessment(a.getId());
                    finalizer.finalizeExpired(list, now);
                    return list.stream().map(mapper::toSummary).toList();
                })
                .orElse(List.of());
    }

    @Transactional
    public AttemptResultDto instructorView(CurrentUser me, UUID attemptId) {
        Attempt attempt = requireManageable(me, attemptId);
        finalizer.finalizeIfExpired(attempt, Instant.now(clock));
        return mapper.toResult(attempt, true);
    }

    @Transactional
    public AttemptResultDto grade(CurrentUser me, UUID attemptId, List<Grade> grades) {
        Attempt attempt = requireManageable(me, attemptId);
        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            throw new ConflictException("ATTEMPT_NOT_SUBMITTED", "The attempt has not been submitted yet");
        }
        Map<UUID, AttemptAnswer> byQuestion = new HashMap<>();
        attempt.getAnswers().forEach(a -> byQuestion.put(a.getQuestionId(), a));
        Map<String, MessageRef> errors = new java.util.LinkedHashMap<>();
        for (int i = 0; i < grades.size(); i++) {
            Grade g = grades.get(i);
            AttemptAnswer answer = byQuestion.get(g.questionId());
            if (answer == null) {
                errors.put("grades[" + i + "].questionId", new MessageRef("validation.unknownQuestion"));
            } else if (g.pointsAwarded() > answer.getPoints()) {
                errors.put("grades[" + i + "].pointsAwarded", new MessageRef("validation.grade.max", answer.getPoints()));
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        for (Grade g : grades) {
            AttemptAnswer answer = byQuestion.get(g.questionId());
            answer.setPointsAwarded(g.pointsAwarded());
            answer.setCorrect(g.pointsAwarded() >= answer.getPoints());
            answer.setFeedback(g.feedback() == null || g.feedback().isBlank() ? null : g.feedback().strip());
        }
        attempt.recomputeScore();
        AttemptStatus before = attempt.getStatus();
        if (!attempt.needsManualGrading()) {
            attempt.setStatus(AttemptStatus.GRADED);
        }
        if (before != AttemptStatus.GRADED && attempt.getStatus() == AttemptStatus.GRADED) {
            ContentItem item = attempt.getAssessment().getItem();
            UUID courseId = item.getModule().getCourse().getId();
            String link = Links.learnAttempt(courseId, item.getId(), attempt.getId());
            User student = attempt.getStudent();
            notifications.notifyWithEmail(student, NotificationType.ATTEMPT_GRADED, "notification.attemptGraded", link,
                    null, templates.attemptGraded(student, item.getTitle(), templates.link(link)), item.getTitle());
        }
        return mapper.toResult(attempt, true);
    }

    private Attempt requireManageable(CurrentUser me, UUID attemptId) {
        Attempt attempt = attempts.findWithContext(attemptId).orElseThrow(() -> NotFoundException.of("Attempt"));
        Course course = attempt.getAssessment().getItem().getModule().getCourse();
        if (!CourseAccess.canManage(course, me)) {
            throw NotFoundException.of("Attempt");
        }
        return attempt;
    }

    private Assessment requireAssessment(ContentItem item) {
        if (!item.getType().isAssessment()) {
            throw new NotFoundException("ASSESSMENT_NOT_FOUND", "This item is not a quiz or exam");
        }
        return assessments.findByItemId(item.getId())
                .orElseThrow(() -> new NotFoundException("ASSESSMENT_NOT_FOUND", "This item is not a quiz or exam"));
    }

}
