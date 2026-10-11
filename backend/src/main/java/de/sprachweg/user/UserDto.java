package de.sprachweg.user;

import java.time.Instant;
import java.util.UUID;

/** {@code avatarMediaId} is an addition to the contract so the profile form can keep the current avatar. */
public record UserDto(UUID id, String fullName, String email, Role role, boolean emailVerified, String bio,
                      String avatarUrl, UUID avatarMediaId, Instant createdAt) {
}
