package me.amanullah.course.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Registration rules ({@code app.registration.*}).
 *
 * @param instructorApprovalRequired new INSTRUCTOR accounts start as PENDING until an admin approves them
 * @param termsRequired              registration requires {@code acceptTerms: true} (stored as terms_accepted_at)
 */
@ConfigurationProperties(prefix = "app.registration")
public record RegistrationProperties(
        @DefaultValue("true") boolean instructorApprovalRequired,
        @DefaultValue("true") boolean termsRequired) {
}
