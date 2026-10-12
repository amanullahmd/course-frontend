package me.amanullah.course.flashcard;

import me.amanullah.course.media.MediaDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class FlashcardDtos {

    private FlashcardDtos() {
    }

    // ---------- instructor ----------

    public record FlashcardDto(UUID id, String front, String back, String article, String plural, String example,
                               MediaDto audio, MediaDto image, int position) {
    }

    public record DeckDto(UUID itemId, List<FlashcardDto> cards) {
    }

    /** {@code article} is der, die or das (any case) or empty. */
    public record FlashcardUpsert(UUID id,
                                  @NotBlank @Size(max = 500) String front,
                                  @NotBlank @Size(max = 500) String back,
                                  @Size(max = 10) String article,
                                  @Size(max = 200) String plural,
                                  @Size(max = 1000) String example,
                                  UUID audioMediaId,
                                  UUID imageMediaId) {
    }

    public record DeckUpsert(@NotNull @Size(max = 2000) List<@Valid @NotNull FlashcardUpsert> cards) {
    }

    public record CsvCardDto(String front, String back, String article, String plural, String example) {
    }

    public record CsvErrorDto(int line, String field, String code) {
    }

    /** Preview ({@code committed=false}) or result of a CSV import; {@code errors} lists the skipped rows. */
    public record ImportResultDto(int rows, List<CsvCardDto> cards, List<CsvErrorDto> errors, boolean committed,
                                  int imported, int totalCards) {
    }

    // ---------- learner ----------

    public record LearnerCardDto(UUID id, String front, String back, String article, String plural, String example,
                                 MediaDto audio, MediaDto image, boolean reviewed, Instant dueAt) {
    }

    public record LearnerDeckDto(UUID itemId, List<LearnerCardDto> cards, int dueCount, int newCount) {
    }

    public record ReviewCardDto(UUID id, UUID deckItemId, String deckTitle, String front, String back, String article,
                                String plural, String example, MediaDto audio, MediaDto image, boolean newCard,
                                int intervalDays) {
    }

    /** {@code dueCount}/{@code newCount}: cards waiting in total (before the session limit). */
    public record ReviewSessionDto(UUID courseId, List<ReviewCardDto> cards, int dueCount, int newCount,
                                   int newPerDay) {
    }

    public record ReviewRequest(@NotNull Grade grade) {
    }

    public record ReviewResultDto(UUID cardId, Instant dueAt, int intervalDays, double ease, int repetitions,
                                  int lapses) {
    }

    public record CourseDueDto(UUID courseId, String courseTitle, int due, int newCards) {
    }

    /** {@code dueToday} = due reviews plus new cards still available today, over all courses. */
    public record ReviewSummaryDto(int dueToday, List<CourseDueDto> byCourse) {
    }
}
