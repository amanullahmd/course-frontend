package me.amanullah.course.live;

import me.amanullah.course.common.web.Links;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.user.User;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Notifies the learners of a course 24 hours before a live session (every 5 minutes, idempotent through
 * {@code reminder_sent_at}, ShedLock for multiple instances). Disabled with {@code app.live.reminders.enabled=false};
 * tests call {@link #sendDue(Instant)} directly.
 */
@Component
public class LiveReminderJob {

    private static final Logger log = LoggerFactory.getLogger(LiveReminderJob.class);
    public static final Duration LEAD_TIME = Duration.ofHours(24);
    private static final int BATCH_SIZE = 50;

    private final LiveSessionRepository sessions;
    private final EnrollmentRepository enrollments;
    private final NotificationService notifications;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final boolean enabled;

    public LiveReminderJob(LiveSessionRepository sessions, EnrollmentRepository enrollments,
                           NotificationService notifications, TransactionTemplate tx, Clock clock,
                           @Value("${app.live.reminders.enabled:true}") boolean enabled) {
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.notifications = notifications;
        this.tx = tx;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.live.reminders.interval-ms:300000}",
            initialDelayString = "${app.live.reminders.initial-delay-ms:30000}")
    @SchedulerLock(name = "LiveReminderJob.sendDue", lockAtMostFor = "PT5M", lockAtLeastFor = "PT5S")
    public void scheduledRun() {
        if (!enabled) {
            return;
        }
        try {
            int n = sendDue(Instant.now(clock));
            if (n > 0) {
                log.info("Sent reminders for {} live session(s)", n);
            }
        } catch (RuntimeException e) {
            log.warn("Live session reminder run failed", e);
        }
    }

    /** Sends the reminder of every session starting within 24 hours; returns how many sessions were announced. */
    public int sendDue(Instant now) {
        int sent = 0;
        List<UUID> ids = sessions.findDueForReminder(now, now.plus(LEAD_TIME), PageRequest.of(0, BATCH_SIZE));
        for (UUID id : ids) {
            try {
                Boolean done = tx.execute(s -> sessions.findWithCourse(id)
                        .filter(x -> !x.isCancelled() && x.getReminderSentAt() == null)
                        .map(x -> {
                            x.setReminderSentAt(now);
                            String link = Links.learnLive(x.getCourse().getId());
                            for (Enrollment e : enrollments.findByCourse(x.getCourse().getId(),
                                    EnrollmentStatus.APPROVED)) {
                                User u = e.getStudent();
                                if (u.isEnabled()) {
                                    notifications.notify(u, NotificationType.LIVE_SESSION_REMINDER,
                                            "notification.liveReminder", link, null, x.getTitle(),
                                            LiveSessionService.formatStart(x.getStartsAt(), u.preferredLocale()),
                                            x.getCourse().getTitle());
                                }
                            }
                            return true;
                        }).orElse(false));
                if (Boolean.TRUE.equals(done)) {
                    sent++;
                }
            } catch (RuntimeException e) {
                log.warn("Could not send the reminder for live session {}: {}", id, e.toString());
            }
        }
        return sent;
    }
}
