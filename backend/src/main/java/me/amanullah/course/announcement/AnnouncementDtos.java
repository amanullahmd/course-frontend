package me.amanullah.course.announcement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AnnouncementDtos {

    private AnnouncementDtos() {
    }

    /** Maximum length of the sanitized HTML body. */
    public static final int MAX_BODY = 20_000;

    /** Maximum number of learners in a SELECTED audience. */
    public static final int MAX_RECIPIENTS = 500;

    /**
     * Create / update. {@code status} is DRAFT (default) or SCHEDULED (then {@code scheduledAt} must be in the
     * future); sending happens with {@code POST /announcements/{id}/send} or by the scheduler. For a SENT
     * announcement only title, body and pinned change (recipients are not notified again).
     */
    public record AnnouncementUpsert(
            @NotBlank @Size(max = 200) String title,
            @NotNull @Size(max = 2 * MAX_BODY) String body,
            @NotNull AnnouncementAudience audience,
            @Size(max = MAX_RECIPIENTS) List<@NotNull UUID> recipientIds,
            Boolean sendEmail,
            Boolean pinned,
            AnnouncementStatus status,
            Instant scheduledAt) {
    }

    public record AuthorDto(UUID id, String fullName, String avatarUrl) {
    }

    /**
     * Instructor view. For SENT announcements {@code recipientCount} / {@code readCount} are the actual recipients;
     * for drafts and scheduled ones {@code recipientCount} is the number of learners it would reach right now.
     */
    public record AnnouncementDto(UUID id, UUID courseId, String courseTitle, AuthorDto author, String title,
                                  String body, AnnouncementAudience audience, List<UUID> recipientIds,
                                  boolean sendEmail, boolean pinned, AnnouncementStatus status, Instant scheduledAt,
                                  Instant sentAt, Instant createdAt, Instant updatedAt, long recipientCount,
                                  long readCount, int readPercent) {
    }

    /** Learner view of a sent announcement; {@code edited} = changed after it was sent. */
    public record LearnerAnnouncementDto(UUID id, UUID courseId, AuthorDto author, String title, String body,
                                         boolean pinned, Instant sentAt, Instant updatedAt, boolean edited,
                                         boolean read) {
    }

    public record CourseUnreadDto(UUID courseId, long count) {
    }
}
