package me.amanullah.course.live;

import me.amanullah.course.user.UserSummaryDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LiveDtos {

    private LiveDtos() {
    }

    // ---------- instructor ----------

    public record LiveSessionUpsert(@NotBlank @Size(max = 200) String title,
                                    @Size(max = 5000) String description,
                                    @NotNull Instant startsAt,
                                    @NotNull @Min(5) @Max(720) Integer durationMinutes,
                                    @Size(max = 2000) String joinUrl,
                                    @Size(max = 2000) String recordingUrl,
                                    Boolean cancelled) {
    }

    /** Weekly series; the weekday and local time (Europe/Berlin) stay the same across daylight saving changes. */
    public record SeriesRequest(@NotBlank @Size(max = 200) String title,
                                @Size(max = 5000) String description,
                                @NotNull Instant firstStartsAt,
                                @NotNull @Min(1) @Max(52) Integer weeks,
                                @NotNull @Min(5) @Max(720) Integer durationMinutes,
                                @Size(max = 2000) String joinUrl) {
    }

    public record LiveSessionDto(UUID id, UUID courseId, UUID seriesId, String title, String description,
                                 Instant startsAt, Instant endsAt, int durationMinutes, String joinUrl,
                                 String recordingUrl, boolean cancelled, int attendanceRecorded, int presentCount,
                                 Instant createdAt) {
    }

    public record AttendanceEntry(@NotNull UUID studentId, @NotNull AttendanceStatus status) {
    }

    public record AttendanceRequest(@NotNull @Size(max = 1000) List<@Valid @NotNull AttendanceEntry> entries) {
    }

    /** {@code status} is null while nothing was recorded for the learner. */
    public record AttendanceRow(UserSummaryDto student, AttendanceStatus status) {
    }

    public record AttendanceSheetDto(UUID sessionId, List<AttendanceRow> rows) {
    }

    // ---------- learner ----------

    /** {@code joinUrl} is only present from 15 minutes before the start until the end (and never when cancelled). */
    public record LearnerLiveSessionDto(UUID id, UUID courseId, String courseTitle, String title, String description,
                                        Instant startsAt, Instant endsAt, int durationMinutes, boolean cancelled,
                                        String joinUrl, Instant joinOpensAt, String recordingUrl,
                                        AttendanceStatus myAttendance) {
    }

    // ---------- calendar ----------

    public record CalendarTokenDto(String token, String url) {
    }
}
