package me.amanullah.course.assignment;

import me.amanullah.course.media.MediaDto;
import me.amanullah.course.user.UserSummaryDto;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AssignmentDtos {

    private AssignmentDtos() {
    }

    // ---------- settings ----------

    public record AssignmentDto(UUID itemId, Instant dueAt, boolean allowLate, int maxPoints, int maxFiles,
                                int maxSubmissions, boolean allowText) {
    }

    public record AssignmentUpsert(Instant dueAt,
                                   Boolean allowLate,
                                   @Min(1) @Max(1000) Integer maxPoints,
                                   @Min(0) @Max(20) Integer maxFiles,
                                   @Min(1) @Max(20) Integer maxSubmissions,
                                   Boolean allowText) {
    }

    /**
     * Learner view of the settings. {@code submitBlocked} is null when a (new) version can be submitted, otherwise
     * one of UNDER_REVIEW, GRADED, MAX_SUBMISSIONS, CLOSED.
     */
    public record LearnerAssignmentDto(UUID itemId, Instant dueAt, boolean allowLate, int maxPoints, int maxFiles,
                                       int maxSubmissions, boolean allowText, int submissionsUsed, boolean overdue,
                                       boolean canSubmit, String submitBlocked) {
    }

    // ---------- submissions ----------

    public record SubmissionFileDto(MediaDto media, boolean feedbackFile) {
    }

    /** What the learner sees: points and feedback only once the instructor returned or graded the version. */
    public record SubmissionDto(UUID id, UUID itemId, int versionNo, SubmissionStatus status, String textAnswer,
                                List<SubmissionFileDto> files, Instant submittedAt, boolean late, Double points,
                                Integer maxPoints, String feedback, Instant gradedAt) {
    }

    public record SubmitRequest(@Size(max = 20000) String textAnswer,
                                @Size(max = 20) List<@NotNull UUID> mediaIds) {
    }

    // ---------- instructor ----------

    public record SubmissionSummaryDto(UUID id, UUID itemId, String itemTitle, UUID courseId, UserSummaryDto student,
                                       int versionNo, SubmissionStatus status, boolean late, Instant submittedAt,
                                       Double points, int maxPoints, int fileCount, boolean hasText) {
    }

    public record SubmissionDetailDto(SubmissionSummaryDto summary, AssignmentDto assignment, SubmissionDto current,
                                      List<SubmissionDto> history, boolean latest) {
    }

    public record ReviewRequest(@DecimalMin("0") @DecimalMax("100000") Double points,
                                @Size(max = 20000) String feedback,
                                @NotNull ReviewAction action,
                                @Size(max = 10) List<@NotNull UUID> feedbackMediaIds) {
    }
}
