package me.amanullah.course.admin;

import me.amanullah.course.user.Role;
import java.time.Instant;
import java.util.UUID;

public final class AdminDtos {

    private AdminDtos() {
    }

    /** {@code enrollments} counts APPROVED enrollments. */
    public record StatsDto(long users, long students, long instructors, long courses, long liveCourses,
                           long enrollments) {
    }

    /** UserDto + enabled. */
    public record AdminUserDto(UUID id, String fullName, String email, Role role, boolean emailVerified, String bio,
                               String avatarUrl, UUID avatarMediaId, String locale, Instant createdAt, boolean enabled) {
    }

    public record UpdateUserRequest(Role role, Boolean enabled) {
    }
}
