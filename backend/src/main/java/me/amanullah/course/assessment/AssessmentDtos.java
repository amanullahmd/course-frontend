package me.amanullah.course.assessment;

import me.amanullah.course.media.MediaDto;
import me.amanullah.course.user.UserSummaryDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AssessmentDtos {

    private AssessmentDtos() {
    }

    // ---------- instructor: builder ----------

    public record OptionDto(UUID id, String text, boolean correct, int position) {
    }

    public record QuestionDto(UUID id, QuestionType type, String prompt, String explanation, int points, int position,
                              boolean caseSensitive, List<String> acceptedAnswers, UUID mediaId, MediaDto media,
                              List<OptionDto> options) {
    }

    public record AssessmentDto(UUID itemId, String instructions, Integer timeLimitMinutes, int maxAttempts,
                                int passingScore, boolean shuffleQuestions, boolean showCorrectAnswers,
                                Instant availableFrom, Instant availableUntil, List<QuestionDto> questions) {
    }

    public record OptionUpsert(UUID id, @NotBlank @Size(max = 2000) String text, Boolean correct, Integer position) {
    }

    public record QuestionUpsert(UUID id,
                                 @NotNull QuestionType type,
                                 @NotBlank @Size(max = 20000) String prompt,
                                 @Size(max = 20000) String explanation,
                                 @Min(0) @Max(1000) Integer points,
                                 Integer position,
                                 Boolean caseSensitive,
                                 @Size(max = 50) List<@NotBlank @Size(max = 500) String> acceptedAnswers,
                                 UUID mediaId,
                                 @Size(max = 20) List<@Valid @NotNull OptionUpsert> options) {
    }

    public record AssessmentUpsert(@Size(max = 20000) String instructions,
                                   @Min(1) @Max(1440) Integer timeLimitMinutes,
                                   @Min(0) @Max(1000) Integer maxAttempts,
                                   @Min(0) @Max(100) Integer passingScore,
                                   Boolean shuffleQuestions,
                                   Boolean showCorrectAnswers,
                                   Instant availableFrom,
                                   Instant availableUntil,
                                   @Size(max = 200) List<@Valid @NotNull QuestionUpsert> questions) {
    }

    // ---------- attempts ----------

    public record SessionOption(UUID id, String text) {
    }

    public record SessionQuestion(UUID id, QuestionType type, String prompt, int points, MediaDto media,
                                  List<SessionOption> options) {
    }

    /**
     * {@code deadline} is the effective deadline: the attempt's time limit capped at the end of the assessment window
     * (also set for untimed attempts when the window closes), {@code null} when the attempt never expires.
     * {@code timeLimitMinutes}, {@code availableUntil}, {@code serverTime} (to correct client clock skew) and
     * {@code savedAnswers} (autosaved drafts, restored on resume) are additions to the contract.
     */
    public record AttemptSessionDto(UUID id, AttemptStatus status, Instant startedAt, Instant deadline,
                                    Integer timeLimitMinutes, Instant availableUntil, Instant serverTime,
                                    List<SessionQuestion> questions, List<SubmittedAnswer> savedAnswers) {
    }

    public record SubmittedAnswer(@NotNull UUID questionId, @Size(max = 50) List<@NotNull UUID> selectedOptionIds,
                                  @Size(max = 20000) String textAnswer) {
    }

    public record SubmitRequest(@NotNull @Size(max = 500) List<@Valid @NotNull SubmittedAnswer> answers) {
    }

    /** Body of the autosave endpoint (same shape as a submission). */
    public record SaveAnswersRequest(@NotNull @Size(max = 500) List<@Valid @NotNull SubmittedAnswer> answers) {
    }

    public record Grade(@NotNull UUID questionId, @NotNull @DecimalMin("0.0") Double pointsAwarded,
                        @Size(max = 5000) String feedback) {
    }

    public record GradeRequest(@NotNull @Size(min = 1, max = 500) List<@Valid @NotNull Grade> grades) {
    }

    /**
     * {@code late} (submitted after deadline + 30 s grace) and {@code autoSubmitted} (submitted by the server with the
     * autosaved answers because time ran out or the window closed) are additions to the contract.
     */
    public record AttemptSummaryDto(UUID id, UserSummaryDto student, AttemptStatus status, Instant startedAt,
                                    Instant submittedAt, Double score, double maxScore, Double percent, Boolean passed,
                                    boolean pendingManualGrading, boolean late, boolean autoSubmitted) {
    }

    public record ResultOption(UUID id, String text, Boolean correct) {
    }

    /** {@code explanation} and {@code media} are additions to the contract. */
    public record AnswerResult(UUID questionId, QuestionType type, String prompt, int points,
                               List<UUID> selectedOptionIds, String textAnswer, Boolean correct, Double pointsAwarded,
                               String feedback, List<ResultOption> options, List<String> acceptedAnswers,
                               String explanation, MediaDto media) {
    }

    public record AttemptResultDto(UUID id, UserSummaryDto student, AttemptStatus status, Instant startedAt,
                                   Instant submittedAt, Double score, double maxScore, Double percent, Boolean passed,
                                   boolean pendingManualGrading, boolean late, boolean autoSubmitted,
                                   UUID itemId, String itemTitle,
                                   Instant deadline, List<AnswerResult> answers) {
    }
}
