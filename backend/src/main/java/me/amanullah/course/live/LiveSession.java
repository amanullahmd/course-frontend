package me.amanullah.course.live;

import me.amanullah.course.common.persistence.AuditedEntity;
import me.amanullah.course.course.Course;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** A live lesson (video call) of a course. The join URL is only shown to learners shortly before the start. */
@Entity
@Table(name = "live_sessions")
public class LiveSession extends AuditedEntity {

    /** Learners see the join link from this long before the start. */
    public static final Duration JOIN_WINDOW = Duration.ofMinutes(15);

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "series_id")
    private UUID seriesId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 5000)
    private String description;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "join_url", length = 2000)
    private String joinUrl;

    @Column(name = "recording_url", length = 2000)
    private String recordingUrl;

    @Column(nullable = false)
    private boolean cancelled;

    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    protected LiveSession() {
    }

    public LiveSession(Course course) {
        this.course = course;
    }

    public Instant endsAt() {
        return startsAt.plus(Duration.ofMinutes(durationMinutes));
    }

    public Instant joinOpensAt() {
        return startsAt.minus(JOIN_WINDOW);
    }

    /** True from 15 minutes before the start until the end of an active session. */
    public boolean joinable(Instant now) {
        return !cancelled && !now.isBefore(joinOpensAt()) && now.isBefore(endsAt());
    }

    public Course getCourse() { return course; }
    public UUID getSeriesId() { return seriesId; }
    public void setSeriesId(UUID seriesId) { this.seriesId = seriesId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getStartsAt() { return startsAt; }
    public void setStartsAt(Instant startsAt) { this.startsAt = startsAt; }
    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    public String getJoinUrl() { return joinUrl; }
    public void setJoinUrl(String joinUrl) { this.joinUrl = joinUrl; }
    public String getRecordingUrl() { return recordingUrl; }
    public void setRecordingUrl(String recordingUrl) { this.recordingUrl = recordingUrl; }
    public boolean isCancelled() { return cancelled; }
    public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }
    public Instant getReminderSentAt() { return reminderSentAt; }
    public void setReminderSentAt(Instant reminderSentAt) { this.reminderSentAt = reminderSentAt; }
}
