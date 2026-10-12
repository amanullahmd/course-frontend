package me.amanullah.course.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * In-memory rate limits ({@code app.rate-limit.*}). Every rule has the form {@code <requests>/<period>}, e.g.
 * {@code 10/1m} or {@code 3/24h}. Buckets live in the JVM, so with several instances each instance enforces its own
 * limits (use a shared Bucket4j backend such as Redis when scaling out).
 */
@Validated
@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
        @DefaultValue("true") boolean enabled,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("10/1m") String loginPerIp,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("5/1m") String loginPerEmail,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("5/1h") String registerPerIp,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("3/1h") String mailPerEmail,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("10/1h") String mailPerIp,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("20/1h") String tokenPerIp,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("60/1h") String uploadPerUser,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("3/24h") String exportPerUser,
        @NotBlank @Pattern(regexp = RULE) @DefaultValue("5/1h") String deleteAccountPerUser) {

    public static final String RULE = "^\\s*\\d{1,9}\\s*/\\s*\\d{1,9}\\s*(ms|s|m|h|d)\\s*$";
}
