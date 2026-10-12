package me.amanullah.course.announcement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.user.User;

/** One learner who received a sent announcement; {@code readAt} is set when they view it. */
@Entity
@Table(name = "announcement_recipients")
public class AnnouncementRecipient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", nullable = false)
    private Announcement announcement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "emailed_at")
    private Instant emailedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AnnouncementRecipient() {
    }

    public AnnouncementRecipient(Announcement announcement, User user, Instant createdAt) {
        this.announcement = announcement;
        this.user = user;
        this.createdAt = createdAt;
    }

    public Announcement getAnnouncement() { return announcement; }
    public User getUser() { return user; }
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
    public Instant getEmailedAt() { return emailedAt; }
    public void setEmailedAt(Instant emailedAt) { this.emailedAt = emailedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
