package me.amanullah.course.user;

import java.util.UUID;

/** Compact user reference ({@code {id,fullName,email,avatarUrl}}) used in enrollments and attempts. */
public record UserSummaryDto(UUID id, String fullName, String email, String avatarUrl) {
}
