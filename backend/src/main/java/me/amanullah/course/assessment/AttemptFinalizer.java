package me.amanullah.course.assessment;

import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.Course;
import me.amanullah.course.learning.ItemProgress;
import me.amanullah.course.learning.ItemProgressRepository;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Completes attempts: grades the answers stored on the attempt, records progress and notifies the instructor when
 * manual grading is needed. Also decides when an in-progress attempt has expired and submits it automatically with
 * the saved draft answers ("expiry finalization"). Callers must run inside a read-write transaction.
 */
@Component
public class AttemptFinalizer {

    /** Submissions up to 30 s after the deadline are accepted normally (network latency). */
    public static final Duration GRACE = Duration.ofSeconds(30);

    private final AttemptRepository attempts;
    private final ItemProgressRepository progress;
    private final NotificationService notifications;

    public AttemptFinalizer(AttemptRepository attempts, ItemProgressRepository progress,
                            NotificationService notifications) {
        this.attempts = attempts;
        this.progress = progress;
        this.notifications = notifications;
    }

    /**
     * The moment an attempt ends: its own deadline (time limit, already capped at the window end when it started)
     * or the end of the assessment window, whichever comes first; {@code null} when neither exists.
     */
    public static Instant effectiveDeadline(Attempt a) {
        Instant deadline = a.getDeadline();
        Instant windowEnd = a.getAssessment().getAvailableUntil();
        if (deadline == null) {
            return windowEnd;
        }
        if (windowEnd == null) {
            return deadline;
        }
        return deadline.isBefore(windowEnd) ? deadline : windowEnd;
    }

    /** True for an in-progress attempt whose effective deadline plus {@link #GRACE} has passed. */
    public static boolean isExpired(Attempt a, Instant now) {
        if (a.getStatus() != AttemptStatus.IN_PROGRESS) {
            return false;
        }
        Instant end = effectiveDeadline(a);
        return end != null && now.isAfter(end.plus(GRACE));
    }

    /**
     * Submits an expired attempt with its saved draft answers ({@code autoSubmitted=true}, {@code submittedAt} = the
     * effective deadline). Returns false (and changes nothing) when the attempt has not expired.
     */
    public boolean finalizeIfExpired(Attempt attempt, Instant now) {
        if (!isExpired(attempt, now)) {
            return false;
        }
        Instant end = effectiveDeadline(attempt);
        Instant submittedAt = end.isBefore(attempt.getStartedAt()) ? attempt.getStartedAt() : end;
        complete(attempt, submittedAt, false, true);
        return true;
    }

    /** Lazily finalizes the student's expired in-progress attempts of one assessment. */
    public void finalizeExpired(UUID assessmentId, UUID studentId, Instant now) {
        attempts.findFirstByAssessmentIdAndStudentIdAndStatus(assessmentId, studentId, AttemptStatus.IN_PROGRESS)
                .ifPresent(a -> finalizeIfExpired(a, now));
    }

    /**
     * Same as {@link #finalizeExpired(UUID, UUID, Instant)} but committed in its own transaction, so the
     * finalization survives when the caller's transaction is rolled back afterwards (e.g. starting a new attempt is
     * refused).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finalizeExpiredInNewTransaction(UUID assessmentId, UUID studentId, Instant now) {
        finalizeExpired(assessmentId, studentId, now);
    }

    /** Lazily finalizes every expired attempt in the list (e.g. before listing them). */
    public void finalizeExpired(List<Attempt> list, Instant now) {
        list.forEach(a -> finalizeIfExpired(a, now));
    }

    /** Grades the answers currently stored on the attempt and marks it submitted (or graded). */
    public void complete(Attempt attempt, Instant submittedAt, boolean late, boolean autoSubmitted) {
        for (AttemptAnswer answer : attempt.getAnswers()) {
            String text = answer.getTextAnswer();
            answer.setTextAnswer(text == null || text.isBlank() ? null : text.strip());
            Grader.grade(answer);
        }
        attempt.setSubmittedAt(submittedAt);
        attempt.setLate(late);
        attempt.setAutoSubmitted(autoSubmitted);
        attempt.recomputeScore();
        boolean manual = attempt.needsManualGrading();
        attempt.setStatus(manual ? AttemptStatus.SUBMITTED : AttemptStatus.GRADED);
        ContentItem item = attempt.getAssessment().getItem();
        UUID studentId = attempt.getStudent().getId();
        // Submitting a quiz/exam counts as working through that item, so it shows up in the course progress.
        if (!progress.existsByStudentIdAndItemId(studentId, item.getId())) {
            progress.save(new ItemProgress(attempt.getStudent(), item, submittedAt));
        }
        if (manual) {
            Course course = item.getModule().getCourse();
            notifications.notify(course.getInstructor(), NotificationType.ATTEMPT_SUBMITTED,
                    "notification.attemptSubmitted", Links.instructorAttempt(attempt.getId()), null,
                    attempt.getStudent().getFullName(), item.getTitle());
        }
    }
}
