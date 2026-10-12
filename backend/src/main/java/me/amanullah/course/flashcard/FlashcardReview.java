package me.amanullah.course.flashcard;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Spaced repetition state of one learner for one card. */
@Entity
@Table(name = "flashcard_reviews")
public class FlashcardReview extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Flashcard card;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false)
    private int repetitions;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(nullable = false)
    private double ease = Sm2Scheduler.INITIAL_EASE;

    @Column(nullable = false)
    private int lapses;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Column(name = "first_reviewed_at", nullable = false)
    private Instant firstReviewedAt;

    @Column(name = "last_reviewed_at")
    private Instant lastReviewedAt;

    protected FlashcardReview() {
    }

    public FlashcardReview(Flashcard card, User student, Instant now) {
        this.card = card;
        this.student = student;
        this.dueAt = now;
        this.firstReviewedAt = now;
    }

    public Sm2Scheduler.State state() {
        return new Sm2Scheduler.State(repetitions, intervalDays, ease, lapses, dueAt);
    }

    public void apply(Sm2Scheduler.State s, Instant reviewedAt) {
        this.repetitions = s.repetitions();
        this.intervalDays = s.intervalDays();
        this.ease = s.ease();
        this.lapses = s.lapses();
        this.dueAt = s.dueAt();
        this.lastReviewedAt = reviewedAt;
    }

    public Flashcard getCard() { return card; }
    public User getStudent() { return student; }
    public int getRepetitions() { return repetitions; }
    public int getIntervalDays() { return intervalDays; }
    public double getEase() { return ease; }
    public int getLapses() { return lapses; }
    public Instant getDueAt() { return dueAt; }
    public Instant getFirstReviewedAt() { return firstReviewedAt; }
    public Instant getLastReviewedAt() { return lastReviewedAt; }
}
