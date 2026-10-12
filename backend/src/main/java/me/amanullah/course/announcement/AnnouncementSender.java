package me.amanullah.course.announcement;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.notification.MailService;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.user.User;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Delivers an announcement: resolves the recipients at send time (APPROVED learners of the course, optionally
 * restricted to the selected ones), records them for read tracking, creates in-app notifications and, if requested,
 * queues e-mails in each recipient's language (sent after commit).
 */
@Component
public class AnnouncementSender {

    private final EnrollmentRepository enrollments;
    private final AnnouncementRecipientRepository recipients;
    private final NotificationService notifications;
    private final AnnouncementEmails emails;
    private final MailService mail;

    public AnnouncementSender(EnrollmentRepository enrollments, AnnouncementRecipientRepository recipients,
                              NotificationService notifications, AnnouncementEmails emails, MailService mail) {
        this.enrollments = enrollments;
        this.recipients = recipients;
        this.notifications = notifications;
        this.emails = emails;
        this.mail = mail;
    }

    public static String feedLink(UUID courseId) {
        return "/learn/" + courseId + "/announcements";
    }

    /** Learners the announcement would reach right now. */
    @Transactional(readOnly = true)
    public List<User> resolveRecipients(Announcement a) {
        UUID authorId = a.getAuthor().getId();
        return enrollments.findByCourse(a.getCourse().getId(), EnrollmentStatus.APPROVED).stream()
                .map(Enrollment::getStudent)
                .filter(u -> !u.getId().equals(authorId) && u.isEnabled())
                .filter(u -> a.getAudience() == AnnouncementAudience.ALL_APPROVED
                        || a.getSelectedUserIds().contains(u.getId()))
                .toList();
    }

    /**
     * Sends the announcement; returns the number of recipients. With {@code requireRecipients} an announcement that
     * would reach nobody is rejected (409 NO_RECIPIENTS); the scheduler sends it anyway so it does not stay due.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int deliver(Announcement a, Instant now, boolean requireRecipients) {
        List<User> to = resolveRecipients(a);
        if (to.isEmpty() && requireRecipients) {
            throw new ConflictException("NO_RECIPIENTS", "This announcement has no recipients");
        }
        String link = feedLink(a.getCourse().getId());
        String shortTitle = truncate(a.getTitle(), 150);
        for (User user : to) {
            AnnouncementRecipient r = new AnnouncementRecipient(a, user, now);
            if (a.isSendEmail()) {
                r.setEmailedAt(now);
                mail.send(user.getEmail(), emails.announcement(user, a, link));
            }
            recipients.save(r);
            notifications.notify(user, NotificationType.ANNOUNCEMENT, "notification.announcement", link, null,
                    shortTitle, a.getAuthor().getFullName(), a.getCourse().getTitle());
        }
        a.markSent(now);
        return to.size();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1).stripTrailing() + "…";
    }
}
