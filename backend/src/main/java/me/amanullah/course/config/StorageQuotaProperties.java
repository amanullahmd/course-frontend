package me.amanullah.course.config;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * Per-user storage quota ({@code app.storage.quota.*}): the sum of the sizes of all media a user owns. Admins have
 * no quota.
 */
@Validated
@ConfigurationProperties(prefix = "app.storage.quota")
public record StorageQuotaProperties(
        @NotNull @DefaultValue("5GB") DataSize instructor,
        @NotNull @DefaultValue("200MB") DataSize student) {
}
