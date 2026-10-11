package de.sprachweg.auth;

import de.sprachweg.user.PasswordPolicy;
import de.sprachweg.user.Role;
import de.sprachweg.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 120) String fullName,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
            String password,
            @NotNull Role role) {
    }

    public record TokenRequest(@NotBlank String token) {
    }

    public record EmailRequest(@NotBlank @Email String email) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
            String password) {
    }

    public record AuthResponse(String accessToken, long expiresIn, UserDto user) {
    }
}
