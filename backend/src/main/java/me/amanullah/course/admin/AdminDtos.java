package me.amanullah.course.admin;

import jakarta.validation.constraints.Size;
import me.amanullah.course.user.InstructorStatus;
import me.amanullah.course.user.Role;
import java.time.Instant;
import java.util.UUID;

public final class AdminDtos {

    private AdminDtos() {
    }

    /**
     * {@code enrollments} counts APPROVED enrollments; {@code pendingInstructors} counts instructor accounts waiting
     * for approval.
     */
    public record StatsDto(long users, long students, long instructors, long courses, long liveCourses,
                           long enrollments, long pendingInstructors) {
    }

    /** UserDto + enabled, instructor review status and whether the account was deleted (anonymised). */
    public record AdminUserDto(UUID id, String fullName, String email, Role role, boolean emailVerified, String bio,
                               String avatarUrl, UUID avatarMediaId, String locale, Instant createdAt, boolean enabled,
                               InstructorStatus instructorStatus, boolean deleted) {
    }

    /** Optional reason, included in the e-mail to the instructor. */
    public record InstructorDecisionRequest(@Size(max = 1000) String reason) {
    }

    public record UpdateUserRequest(Role role, Boolean enabled) {
    }
}
