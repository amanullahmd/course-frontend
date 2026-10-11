package me.amanullah.course.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/** All {@code app.*} settings, validated at startup. */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank @DefaultValue("http://localhost:3000") String frontendUrl,
        @NotBlank @DefaultValue("http://localhost:8080") String publicBaseUrl,
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Auth auth,
        @Valid @NotNull Media media,
        @Valid @NotNull Storage storage,
        @Valid @NotNull Mail mail,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Seed seed) {

    public record Jwt(
            @NotBlank @Size(min = 32, message = "must be at least 32 characters") String secret,
            @NotBlank @DefaultValue("sprachweg") String issuer,
            @NotNull @DefaultValue("15m") Duration accessTokenTtl,
            @NotNull @DefaultValue("14d") Duration refreshTokenTtl) {
    }

    public record Auth(
            @NotNull @DefaultValue("24h") Duration emailVerificationTtl,
            @NotNull @DefaultValue("1h") Duration passwordResetTtl,
            @NotBlank @DefaultValue("refresh_token") String refreshCookieName,
            @DefaultValue("false") boolean secureCookie,
            @NotBlank @DefaultValue("Lax") String cookieSameSite) {
    }

    public record Media(
            @NotBlank @Size(min = 32, message = "must be at least 32 characters") String secret,
            @NotNull @DefaultValue("6h") Duration urlTtl) {
    }

    public record Storage(@NotBlank @DefaultValue("./data/uploads") String location) {
    }

    public record Mail(
            @DefaultValue("false") boolean enabled,
            @NotBlank @DefaultValue("Sprachweg <no-reply@sprachweg.de>") String from) {
    }

    public record Cors(@NotEmpty @DefaultValue("http://localhost:3000") List<String> allowedOrigins) {
    }

    public record Seed(@DefaultValue("false") boolean enabled) {
    }
}
