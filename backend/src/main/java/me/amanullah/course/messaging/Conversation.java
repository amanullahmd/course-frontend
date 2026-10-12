package me.amanullah.course.messaging;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.Course;
import me.amanullah.course.user.User;

/**
 * A direct-message thread between two users, optionally in the context of a course. Participants are stored in a
 * canonical order (A has the smaller id); read state and e-mail throttling are kept per side.
 */
@Entity
@Table(name = "conversations")
public class Conversation extends BaseEntity {

    @Column(name = "pair_key", nullable = false, length = 120, updatable = false)
    private String pairKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_a_id", nullable = false, updatable = false)
    private User participantA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_b_id", nullable = false, updatable = false)
    private User participantB;

    @Column(name = "a_last_read_at")
    private Instant aLastReadAt;

    @Column(name = "b_last_read_at")
    private Instant bLastReadAt;

    @Column(name = "a_mail_pending_since")
    private Instant aMailPendingSince;

    @Column(name = "b_mail_pending_since")
    private Instant bMailPendingSince;

    @Column(name = "a_last_emailed_at")
    private Instant aLastEmailedAt;

    @Column(name = "b_last_emailed_at")
    private Instant bLastEmailedAt;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "last_message_preview", length = 200)
    private String lastMessagePreview;

    @Column(name = "last_message_sender_id")
    private UUID lastMessageSenderId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected Conversation() {
    }

    /** {@code first} and {@code second} in any order. */
    public Conversation(Course course, User first, User second, Instant now) {
        boolean firstIsA = first.getId().toString().compareTo(second.getId().toString()) < 0;
        this.participantA = firstIsA ? first : second;
        this.participantB = firstIsA ? second : first;
        this.course = course;
        this.pairKey = pairKey(course == null ? null : course.getId(), first.getId(), second.getId());
        this.createdAt = now;
    }

    public static String pairKey(UUID courseId, UUID u1, UUID u2) {
        String a = u1.toString();
        String b = u2.toString();
        String lo = a.compareTo(b) < 0 ? a : b;
        String hi = a.compareTo(b) < 0 ? b : a;
        return (courseId == null ? "general" : courseId.toString()) + ":" + lo + ":" + hi;
    }

    public boolean isParticipant(UUID userId) {
        return participantA.getId().equals(userId) || participantB.getId().equals(userId);
    }

    public boolean isA(UUID userId) {
        return participantA.getId().equals(userId);
    }

    public User other(UUID userId) {
        return isA(userId) ? participantB : participantA;
    }

    public Instant lastReadAt(UUID userId) {
        return isA(userId) ? aLastReadAt : bLastReadAt;
    }

    public void markRead(UUID userId, Instant now) {
        if (isA(userId)) {
            aLastReadAt = now;
            aMailPendingSince = null;
        } else {
            bLastReadAt = now;
            bMailPendingSince = null;
        }
    }

    /** Records a new message: preview, sender's read marker and the recipient's pending e-mail. */
    public void onMessage(Message m) {
        UUID sender = m.getSender().getId();
        Instant at = m.getCreatedAt();
        lastMessageAt = at;
        lastMessageSenderId = sender;
        String body = m.getBody().replaceAll("\\s+", " ").strip();
        lastMessagePreview = body.length() <= 200 ? body : body.substring(0, 199) + "…";
        markRead(sender, at);
        if (isA(sender)) {
            if (bMailPendingSince == null) {
                bMailPendingSince = at;
            }
        } else if (aMailPendingSince == null) {
            aMailPendingSince = at;
        }
    }

    public Instant mailPendingSince(boolean sideA) {
        return sideA ? aMailPendingSince : bMailPendingSince;
    }

    public Instant lastEmailedAt(boolean sideA) {
        return sideA ? aLastEmailedAt : bLastEmailedAt;
    }

    public void markEmailed(boolean sideA, Instant now) {
        if (sideA) {
            aLastEmailedAt = now;
            aMailPendingSince = null;
        } else {
            bLastEmailedAt = now;
            bMailPendingSince = null;
        }
    }

    public String getPairKey() { return pairKey; }
    public Course getCourse() { return course; }
    public User getParticipantA() { return participantA; }
    public User getParticipantB() { return participantB; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public String getLastMessagePreview() { return lastMessagePreview; }
    public UUID getLastMessageSenderId() { return lastMessageSenderId; }
    public Instant getCreatedAt() { return createdAt; }
}
