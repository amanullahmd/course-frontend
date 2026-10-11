package me.amanullah.course.enrollment;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.Course;
import me.amanullah.course.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "enrollments")
public class Enrollment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private EnrollmentStatus status;

    @Column(length = 2000)
    private String message;

    @Column(name = "decision_reason", length = 2000)
    private String decisionReason;

    @Column(name = "applied_at", nullable = false)
    private Instant appliedAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected Enrollment() {
    }

    public Enrollment(Course course, User student) {
        this.course = course;
        this.student = student;
    }

    /** (Re-)applies, reusing this row after a rejection, withdrawal or revocation. */
    public void apply(String message, Instant now) {
        this.status = EnrollmentStatus.PENDING;
        this.message = message;
        this.decisionReason = null;
        this.appliedAt = now;
        this.decidedAt = null;
    }

    public void decide(EnrollmentStatus status, String reason, Instant now) {
        this.status = status;
        this.decisionReason = reason;
        this.decidedAt = now;
    }

    public Course getCourse() { return course; }
    public User getStudent() { return student; }
    public EnrollmentStatus getStatus() { return status; }
    public String getMessage() { return message; }
    public String getDecisionReason() { return decisionReason; }
    public Instant getAppliedAt() { return appliedAt; }
    public Instant getDecidedAt() { return decidedAt; }
}
