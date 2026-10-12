package me.amanullah.course.enrollment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.Course;
import me.amanullah.course.user.User;

/** An invitation e-mail sent to an address without an account (lower-cased), kept for re-invite throttling. */
@Entity
@Table(name = "course_invitations")
public class CourseInvitation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CourseInvitation() {
    }

    public CourseInvitation(Course course, String email, User invitedBy, Instant createdAt) {
        this.course = course;
        this.email = email;
        this.invitedBy = invitedBy;
        this.createdAt = createdAt;
    }

    public String getEmail() { return email; }
    public Instant getCreatedAt() { return createdAt; }
}
