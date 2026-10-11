package de.sprachweg.enrollment;

import de.sprachweg.course.CourseDtos.CourseSummaryDto;
import de.sprachweg.user.UserSummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class EnrollmentDtos {

    private EnrollmentDtos() {
    }

    public enum BulkAction { APPROVE, REJECT }

    public record ApplyRequest(@Size(max = 2000) String message) {
    }

    public record ReasonRequest(@Size(max = 2000) String reason) {
    }

    public record BulkRequest(@NotNull @Size(min = 1, max = 500) List<@NotNull UUID> ids, @NotNull BulkAction action,
                              @Size(max = 2000) String reason) {
    }

    public record EnrollmentDto(UUID id, UUID courseId, String courseTitle, UserSummaryDto student,
                                EnrollmentStatus status, String message, String decisionReason, Instant appliedAt,
                                Instant decidedAt, Integer waitlistPosition, int progressPercent) {
    }

    public record StudentEnrollmentDto(UUID id, EnrollmentStatus status, String message, String decisionReason,
                                       Instant appliedAt, Instant decidedAt, Integer waitlistPosition,
                                       int progressPercent, CourseSummaryDto course) {
    }
}
