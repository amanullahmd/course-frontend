package me.amanullah.course.announcement;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import me.amanullah.course.common.persistence.AuditedEntity;
import me.amanullah.course.course.Course;
import me.amanullah.course.user.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "announcements")
public class Announcement extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 200)
    private String title;

    /** Sanitized HTML. */
    @Column(nullable = false, length = 20000)
    private String body;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private AnnouncementAudience audience = AnnouncementAudience.ALL_APPROVED;

    /** Learner ids for {@link AnnouncementAudience#SELECTED}. */
    @ElementCollection
    @CollectionTable(name = "announcement_selected_users", joinColumns = @JoinColumn(name = "announcement_id"))
    @Column(name = "user_id", nullable = false)
    private Set<UUID> selectedUserIds = new LinkedHashSet<>();

    @Column(name = "send_email", nullable = false)
    private boolean sendEmail;

    @Column(nullable = false)
    private boolean pinned;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private AnnouncementStatus status = AnnouncementStatus.DRAFT;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected Announcement() {
    }

    public Announcement(Course course, User author) {
        this.course = course;
        this.author = author;
    }

    public void markSent(Instant now) {
        this.status = AnnouncementStatus.SENT;
        this.sentAt = now;
        this.scheduledAt = null;
    }

    public Course getCourse() { return course; }
    public User getAuthor() { return author; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public AnnouncementAudience getAudience() { return audience; }
    public void setAudience(AnnouncementAudience audience) { this.audience = audience; }
    public Set<UUID> getSelectedUserIds() { return selectedUserIds; }
    public void setSelectedUserIds(Set<UUID> ids) { this.selectedUserIds.clear(); this.selectedUserIds.addAll(ids); }
    public boolean isSendEmail() { return sendEmail; }
    public void setSendEmail(boolean sendEmail) { this.sendEmail = sendEmail; }
    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public AnnouncementStatus getStatus() { return status; }
    public void setStatus(AnnouncementStatus status) { this.status = status; }
    public Instant getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(Instant scheduledAt) { this.scheduledAt = scheduledAt; }
    public Instant getSentAt() { return sentAt; }
}
