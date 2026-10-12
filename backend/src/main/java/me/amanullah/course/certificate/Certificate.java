package me.amanullah.course.certificate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.CefrLevel;
import me.amanullah.course.course.Course;
import me.amanullah.course.user.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * An issued certificate. Names, course title and level are snapshots taken at issue time, so later renames do not
 * change a certificate that was already handed out. Revoked certificates are kept (history) but no longer valid.
 */
@Entity
@Table(name = "certificates")
public class Certificate extends BaseEntity {

    @Column(nullable = false, unique = true, length = 32)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    /** Equals the student's id while the certificate is active; cleared on revocation (see V7 migration). */
    @Column(name = "active_student_id")
    private UUID activeStudentId;

    @Column(name = "learner_name", nullable = false, length = 120)
    private String learnerName;

    @Column(name = "course_title", nullable = false, length = 200)
    private String courseTitle;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cefr_level", nullable = false, length = 2)
    private CefrLevel level;

    @Column(name = "instructor_name", nullable = false, length = 120)
    private String instructorName;

    @Column(name = "signer_title", length = 80)
    private String signerTitle;

    @Column(length = 120)
    private String organization;

    /** Custom title at issue time; {@code null} = the localized default title. */
    @Column(length = 80)
    private String title;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "final_score")
    private Double finalScore;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "issue_type", nullable = false, length = 20)
    private IssueType issueType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issued_by")
    private User issuedBy;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_reason", length = 500)
    private String revokedReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by")
    private User revokedBy;

    protected Certificate() {
    }

    public Certificate(String code, Course course, User student, IssueType issueType, User issuedBy, Instant issuedAt) {
        this.code = code;
        this.course = course;
        this.student = student;
        this.activeStudentId = student.getId();
        this.issueType = issueType;
        this.issuedBy = issuedBy;
        this.issuedAt = issuedAt;
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public void revoke(User by, String reason, Instant at) {
        this.revokedAt = at;
        this.revokedBy = by;
        this.revokedReason = reason;
        this.activeStudentId = null;
    }

    public String getCode() { return code; }
    public Course getCourse() { return course; }
    public User getStudent() { return student; }
    public String getLearnerName() { return learnerName; }
    public void setLearnerName(String learnerName) { this.learnerName = learnerName; }
    public String getCourseTitle() { return courseTitle; }
    public void setCourseTitle(String courseTitle) { this.courseTitle = courseTitle; }
    public CefrLevel getLevel() { return level; }
    public void setLevel(CefrLevel level) { this.level = level; }
    public String getInstructorName() { return instructorName; }
    public void setInstructorName(String instructorName) { this.instructorName = instructorName; }
    public String getSignerTitle() { return signerTitle; }
    public void setSignerTitle(String signerTitle) { this.signerTitle = signerTitle; }
    public String getOrganization() { return organization; }
    public void setOrganization(String organization) { this.organization = organization; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Double getFinalScore() { return finalScore; }
    public void setFinalScore(Double finalScore) { this.finalScore = finalScore; }
    public IssueType getIssueType() { return issueType; }
    public User getIssuedBy() { return issuedBy; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public String getRevokedReason() { return revokedReason; }
    public User getRevokedBy() { return revokedBy; }
}
