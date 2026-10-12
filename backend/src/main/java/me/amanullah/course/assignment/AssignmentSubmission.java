package me.amanullah.course.assignment;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One version of a learner's answer to an assignment. */
@Entity
@Table(name = "assignment_submissions")
public class AssignmentSubmission extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Column(name = "text_answer", length = 20000)
    private String textAnswer;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private SubmissionStatus status = SubmissionStatus.SUBMITTED;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(nullable = false)
    private boolean late;

    private Double points;

    @Column(length = 20000)
    private String feedback;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "graded_by")
    private User gradedBy;

    @Column(name = "graded_at")
    private Instant gradedAt;

    @Version
    @Column(nullable = false)
    private long version;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "assignment_submission_files", joinColumns = @JoinColumn(name = "submission_id"))
    @OrderColumn(name = "sort_order")
    private List<SubmissionFile> files = new ArrayList<>();

    protected AssignmentSubmission() {
    }

    public AssignmentSubmission(Assignment assignment, User student, int versionNo, Instant submittedAt, boolean late) {
        this.assignment = assignment;
        this.student = student;
        this.versionNo = versionNo;
        this.submittedAt = submittedAt;
        this.late = late;
    }

    /** All files in order; gaps left by deleted media rows are skipped. */
    public List<SubmissionFile> getFiles() {
        return files.stream().filter(Objects::nonNull).toList();
    }

    public void setFiles(List<SubmissionFile> list) {
        files.clear();
        files.addAll(list);
    }

    public Assignment getAssignment() { return assignment; }
    public User getStudent() { return student; }
    public int getVersionNo() { return versionNo; }
    public String getTextAnswer() { return textAnswer; }
    public void setTextAnswer(String textAnswer) { this.textAnswer = textAnswer; }
    public SubmissionStatus getStatus() { return status; }
    public void setStatus(SubmissionStatus status) { this.status = status; }
    public Instant getSubmittedAt() { return submittedAt; }
    public boolean isLate() { return late; }
    public Double getPoints() { return points; }
    public void setPoints(Double points) { this.points = points; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public User getGradedBy() { return gradedBy; }
    public void setGradedBy(User gradedBy) { this.gradedBy = gradedBy; }
    public Instant getGradedAt() { return gradedAt; }
    public void setGradedAt(Instant gradedAt) { this.gradedAt = gradedAt; }
}
