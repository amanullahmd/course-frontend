package me.amanullah.course.user;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code avatarMediaId} (keep the current avatar in the profile form) and {@code locale} ("en"|"de") are additions
 * to the original contract.
 */
public record UserDto(UUID id, String fullName, String email, Role role, boolean emailVerified, String bio,
                      String avatarUrl, UUID avatarMediaId, String locale, Instant createdAt) {
}
