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
import java.util.Map;
import java.util.UUID;

public final class AssessmentDtos {

    private AssessmentDtos() {
    }

    // ---------- instructor: builder ----------

    /** {@code matchText}: right side of a MATCHING pair; {@code blankIndex}: blank a WORD_BANK chip belongs to. */
    public record OptionDto(UUID id, String text, boolean correct, int position, String matchText, Integer blankIndex) {
    }

    /** Accepted answers of one numbered blank of a CLOZE question. */
    public record BlankDto(int index, List<String> acceptedAnswers) {
    }

    /**
     * {@code scoring}, {@code shuffleOptions}, {@code lenientSpelling}, {@code maxRecordingSeconds} and
     * {@code blanks} belong to the language question types.
     */
    public record QuestionDto(UUID id, QuestionType type, String prompt, String explanation, int points, int position,
                              boolean caseSensitive, List<String> acceptedAnswers, UUID mediaId, MediaDto media,
                              List<OptionDto> options, Scoring scoring, boolean shuffleOptions, boolean lenientSpelling,
                              Integer maxRecordingSeconds, List<BlankDto> blanks) {
    }

    public record AssessmentDto(UUID itemId, String instructions, Integer timeLimitMinutes, int maxAttempts,
                                int passingScore, boolean shuffleQuestions, boolean showCorrectAnswers,
                                Instant availableFrom, Instant availableUntil, List<QuestionDto> questions) {
    }

    public record OptionUpsert(UUID id, @NotBlank @Size(max = 2000) String text, Boolean correct, Integer position,
                               @Size(max = 2000) String matchText, @Min(1) @Max(20) Integer blankIndex) {
    }

    public record BlankUpsert(@NotNull @Min(1) @Max(20) Integer index,
                              @Size(max = 50) List<@NotBlank @Size(max = 500) String> acceptedAnswers) {
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
                                 @Size(max = 20) List<@Valid @NotNull OptionUpsert> options,
                                 Scoring scoring,
                                 Boolean shuffleOptions,
                                 Boolean lenientSpelling,
                                 @Min(1) @Max(3600) Integer maxRecordingSeconds,
                                 @Size(max = 20) List<@Valid @NotNull BlankUpsert> blanks) {
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

    /**
     * {@code options}: choices, word-bank chips (without blank assignment), MATCHING left items or ORDERING items in
     * display order. {@code blankCount} (CLOZE, WORD_BANK), {@code matchTargets} (MATCHING right-hand texts, shuffled)
     * and {@code maxRecordingSeconds} (SPEAKING) never reveal the solution.
     */
    public record SessionQuestion(UUID id, QuestionType type, String prompt, int points, MediaDto media,
                                  List<SessionOption> options, Integer blankCount, List<SessionOption> matchTargets,
                                  Integer maxRecordingSeconds) {
    }

    /**
     * {@code deadline} is the effective deadline: the attempt's time limit capped at the end of the assessment window
     * (also set for untimed attempts when the window closes), {@code null} when the attempt never expires.
     * {@code timeLimitMinutes}, {@code availableUntil}, {@code serverTime} (to correct client clock skew) and
     * {@code savedAnswers} (autosaved drafts, restored on resume) are additions to the contract.
     */
    public record AttemptSessionDto(UUID id, AttemptStatus status, Instant startedAt, Instant deadline,
                                    Integer timeLimitMinutes, Instant availableUntil, Instant serverTime,
                                    List<SessionQuestion> questions, List<SavedAnswer> savedAnswers) {
    }

    /**
     * An answer sheet entry. {@code blanks} (CLOZE: text, WORD_BANK: chip option id, keyed by blank index),
     * {@code pairs} (MATCHING: left option id to right option id), {@code order} (ORDERING: option ids) and
     * {@code responseMediaId} (SPEAKING: the learner's own audio upload) are additions for the language types.
     */
    public record SubmittedAnswer(@NotNull UUID questionId, @Size(max = 50) List<@NotNull UUID> selectedOptionIds,
                                  @Size(max = 20000) String textAnswer,
                                  @Size(max = 50) Map<@NotBlank @Size(max = 10) String, @Size(max = 500) String> blanks,
                                  @Size(max = 50) Map<@NotBlank @Size(max = 40) String, @Size(max = 40) String> pairs,
                                  @Size(max = 50) List<@NotNull @Size(max = 40) String> order,
                                  UUID responseMediaId) {
    }

    /** A saved draft as returned when resuming; {@code responseMedia} carries a signed URL to replay the recording. */
    public record SavedAnswer(UUID questionId, List<UUID> selectedOptionIds, String textAnswer,
                              Map<String, String> blanks, Map<String, String> pairs, List<String> order,
                              UUID responseMediaId, MediaDto responseMedia) {
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

    /** {@code correct}, {@code matchText} and {@code blankIndex} are only set when the solution may be shown. */
    public record ResultOption(UUID id, String text, Boolean correct, String matchText, Integer blankIndex) {
    }

    /** One blank of a CLOZE/WORD_BANK answer; {@code expected} (accepted answers) only when the solution may be shown. */
    public record BlankResult(int index, String given, boolean correct, List<String> expected) {
    }

    /** One pair of a MATCHING answer; {@code expectedRight} only when the solution may be shown. */
    public record PairResult(UUID leftId, String left, UUID rightId, String right, boolean correct,
                             String expectedRight) {
    }

    /** {@code explanation} and {@code media} are additions to the contract. */
    public record AnswerResult(UUID questionId, QuestionType type, String prompt, int points,
                               List<UUID> selectedOptionIds, String textAnswer, Boolean correct, Double pointsAwarded,
                               String feedback, List<ResultOption> options, List<String> acceptedAnswers,
                               String explanation, MediaDto media, Scoring scoring, Map<String, String> blanks,
                               Map<String, String> pairs, List<String> order, List<BlankResult> blankResults,
                               List<PairResult> pairResults, List<UUID> correctOrder, MediaDto responseMedia,
                               Integer maxRecordingSeconds) {
    }

    public record AttemptResultDto(UUID id, UserSummaryDto student, AttemptStatus status, Instant startedAt,
                                   Instant submittedAt, Double score, double maxScore, Double percent, Boolean passed,
                                   boolean pendingManualGrading, boolean late, boolean autoSubmitted,
                                   UUID itemId, String itemTitle,
                                   Instant deadline, List<AnswerResult> answers) {
    }
}
