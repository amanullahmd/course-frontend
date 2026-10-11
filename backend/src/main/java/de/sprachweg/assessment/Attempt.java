package de.sprachweg.assessment;

import de.sprachweg.common.persistence.BaseEntity;
import de.sprachweg.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "attempts")
public class Attempt extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    private Instant deadline;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    private Double score;

    @Column(name = "max_score", nullable = false)
    private double maxScore;

    /** Submitted after deadline + grace period. */
    @Column(nullable = false)
    private boolean late;

    @Version
    @Column(nullable = false)
    private long version;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<AttemptAnswer> answers = new ArrayList<>();

    protected Attempt() {
    }

    public Attempt(Assessment assessment, User student, Instant startedAt, Instant deadline) {
        this.assessment = assessment;
        this.student = student;
        this.startedAt = startedAt;
        this.deadline = deadline;
    }

    public boolean needsManualGrading() {
        return answers.stream().anyMatch(a -> a.getQuestionType() == QuestionType.ESSAY && a.getPointsAwarded() == null);
    }

    public void recomputeScore() {
        this.score = answers.stream().mapToDouble(a -> a.getPointsAwarded() == null ? 0 : a.getPointsAwarded()).sum();
        this.maxScore = answers.stream().mapToInt(AttemptAnswer::getPoints).sum();
    }

    public Assessment getAssessment() { return assessment; }
    public User getStudent() { return student; }
    public AttemptStatus getStatus() { return status; }
    public void setStatus(AttemptStatus status) { this.status = status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getDeadline() { return deadline; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public Double getScore() { return score; }
    public double getMaxScore() { return maxScore; }
    public void setMaxScore(double maxScore) { this.maxScore = maxScore; }
    public boolean isLate() { return late; }
    public void setLate(boolean late) { this.late = late; }
    public List<AttemptAnswer> getAnswers() { return answers; }
}
