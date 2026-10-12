package me.amanullah.course.enrollment;

import me.amanullah.course.course.CourseDtos.CourseSummaryDto;
import me.amanullah.course.user.UserSummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class EnrollmentDtos {

    private EnrollmentDtos() {
    }

    /**
     * {@code APPROVE} also restores REJECTED, REVOKED and WITHDRAWN enrollments (respecting capacity);
     * {@code REVOKE} removes APPROVED learners from the course.
     */
    public enum BulkAction { APPROVE, REJECT, REVOKE }

    public record ApplyRequest(@Size(max = 2000) String message) {
    }

    public record ReasonRequest(@Size(max = 2000) String reason) {
    }

    /**
     * All-or-nothing: if any enrollment is unknown, foreign, in the wrong status or the capacity would be exceeded,
     * nothing changes. When {@code courseId} is given, every id must belong to that course.
     */
    public record BulkRequest(@NotNull @Size(min = 1, max = 500) List<@NotNull UUID> ids, @NotNull BulkAction action,
                              @Size(max = 2000) String reason, UUID courseId) {
    }

    /**
     * Adds learners by e-mail address (trimmed, de-duplicated case-insensitively). {@code invite} e-mails an
     * invitation to addresses without an account.
     */
    public record AddStudentsRequest(@NotNull @Size(min = 1, max = EnrollmentService.MAX_ADD_EMAILS) List<String> emails,
                                     @Size(max = 2000) String message, Boolean invite) {
    }

    /** {@code code}: EMAIL_NOT_VERIFIED, ACCOUNT_DISABLED, OWN_COURSE, CAPACITY_REACHED or ALREADY_INVITED. */
    public record SkippedEmail(String email, String code) {
    }

    /**
     * {@code notFound} lists every address without an account; {@code invited} is the subset that received an
     * invitation with this request (an address is invited at most once per course and 24 hours, otherwise it is
     * reported in {@code skipped} with code ALREADY_INVITED).
     */
    public record AddStudentsResult(List<EnrollmentDto> added, List<String> alreadyEnrolled, List<String> invited,
                                    List<String> notFound, List<SkippedEmail> skipped) {
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
