package me.amanullah.course.auth;

import me.amanullah.course.user.PasswordPolicy;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.UserDto;
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
            @NotBlank @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
            String password,
            @NotNull Role role,
            /** Optional "en" or "de"; defaults to the request locale (Accept-Language), else English. */
            @Pattern(regexp = PasswordPolicy.LOCALE_REGEX, message = PasswordPolicy.LOCALE_MESSAGE) String locale) {
    }

    public record TokenRequest(@NotBlank @Size(max = 200) String token) {
    }

    public record EmailRequest(@NotBlank @Email @Size(max = 255) String email) {
    }

    public record LoginRequest(@NotBlank @Email @Size(max = 255) String email, @NotBlank @Size(max = 200) String password) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
            String password) {
    }

    public record AuthResponse(String accessToken, long expiresIn, UserDto user) {
    }
}
