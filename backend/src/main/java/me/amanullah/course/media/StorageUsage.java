package me.amanullah.course.media;

import java.util.Locale;

/**
 * {@code GET /api/media/usage}: bytes used by the caller's media and their quota ({@code null} = unlimited, admins).
 */
public record StorageUsage(long usedBytes, Long quotaBytes) {

    static String human(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        String[] units = {"KB", "MB", "GB", "TB"};
        double value = bytes;
        int unit = -1;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return String.format(Locale.ROOT, value >= 10 ? "%.0f %s" : "%.1f %s", value, units[unit]);
    }
}
