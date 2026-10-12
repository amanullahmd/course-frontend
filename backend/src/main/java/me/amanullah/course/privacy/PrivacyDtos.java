package me.amanullah.course.privacy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class PrivacyDtos {

    private PrivacyDtos() {
    }

    /** {@code DELETE /api/users/me}: the current password and the typed confirmation word {@code DELETE}. */
    public record DeleteAccountRequest(@NotBlank @Size(max = 200) String password,
                                       @NotBlank @Size(max = 20) String confirm) {
    }
}
