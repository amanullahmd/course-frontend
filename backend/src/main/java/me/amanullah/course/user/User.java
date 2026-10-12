package me.amanullah.course.user;

import me.amanullah.course.common.persistence.AuditedEntity;
import me.amanullah.course.media.MediaAsset;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class User extends AuditedEntity {

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(length = 2000)
    private String bio;

    /** Preferred language ("en" or "de") for e-mails and notifications. */
    @Column(nullable = false, length = 5)
    private String locale = "en";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_id")
    private MediaAsset avatar;

    /** Review state of instructors (null for other roles). */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "instructor_status", length = 20)
    private InstructorStatus instructorStatus;

    @Column(name = "terms_accepted_at")
    private java.time.Instant termsAcceptedAt;

    /** Set when the account was deleted (anonymised); users are never hard-deleted. */
    @Column(name = "deleted_at")
    private java.time.Instant deletedAt;

    protected User() {
    }

    /** Instructors created through this constructor are APPROVED; registration sets PENDING explicitly. */
    public User(String fullName, String email, String passwordHash, Role role) {
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
        setRole(role);
    }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Role getRole() { return role; }
    /** Becoming an instructor (e.g. an admin promotes a student) counts as approved; other roles have no status. */
    public void setRole(Role role) {
        this.role = role;
        if (role != Role.INSTRUCTOR) {
            this.instructorStatus = null;
        } else if (this.instructorStatus == null) {
            this.instructorStatus = InstructorStatus.APPROVED;
        }
    }
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public java.util.Locale preferredLocale() { return me.amanullah.course.common.i18n.I18nConfig.toLocale(locale); }
    public MediaAsset getAvatar() { return avatar; }
    public void setAvatar(MediaAsset avatar) { this.avatar = avatar; }
    public InstructorStatus getInstructorStatus() { return instructorStatus; }
    public void setInstructorStatus(InstructorStatus instructorStatus) { this.instructorStatus = instructorStatus; }
    public java.time.Instant getTermsAcceptedAt() { return termsAcceptedAt; }
    public void setTermsAcceptedAt(java.time.Instant termsAcceptedAt) { this.termsAcceptedAt = termsAcceptedAt; }
    public java.time.Instant getDeletedAt() { return deletedAt; }
    public boolean isDeleted() { return deletedAt != null; }

    /** True for instructors that may create and manage courses (admins always may). */
    public boolean canTeach() {
        return role == Role.ADMIN || (role == Role.INSTRUCTOR && instructorStatus == InstructorStatus.APPROVED);
    }

    /**
     * Anonymises the account ("delete my account"): personal data is replaced, the password becomes unusable and the
     * account is disabled. The row stays so that enrollments, attempts and progress remain for course statistics.
     */
    public void anonymize(String displayName, String randomPasswordHash, java.time.Instant now) {
        this.fullName = displayName;
        this.email = "deleted-" + getId() + "@invalid";
        this.passwordHash = randomPasswordHash;
        this.enabled = false;
        this.emailVerified = false;
        this.bio = null;
        this.avatar = null;
        this.instructorStatus = role == Role.INSTRUCTOR ? InstructorStatus.REJECTED : null;
        this.termsAcceptedAt = null;
        this.deletedAt = now;
    }
}
