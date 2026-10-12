package me.amanullah.course.flashcard;

import me.amanullah.course.flashcard.FlashcardDtos.LearnerDeckDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewRequest;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewResultDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewSessionDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewSummaryDto;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: flashcards")
@RestController
@RequestMapping("/api/student")
public class StudentFlashcardController {

    private final LearnerFlashcardService service;

    public StudentFlashcardController(LearnerFlashcardService service) {
        this.service = service;
    }

    /** Deck browse mode. */
    @GetMapping("/items/{itemId}/flashcards")
    public LearnerDeckDto deck(@PathVariable UUID itemId) {
        return service.deck(CurrentUser.get(), itemId);
    }

    /** Due cards plus up to 15 new cards a day from the visible decks of the course. */
    @GetMapping("/courses/{courseId}/review")
    public ReviewSessionDto session(@PathVariable UUID courseId, @RequestParam(required = false) Integer limit) {
        return service.session(CurrentUser.get(), courseId, limit);
    }

    @PostMapping("/flashcards/{cardId}/review")
    public ReviewResultDto review(@PathVariable UUID cardId, @Valid @RequestBody ReviewRequest request) {
        return service.grade(CurrentUser.get(), cardId, request.grade());
    }

    @GetMapping("/review/summary")
    public ReviewSummaryDto summary() {
        return service.summary(CurrentUser.get());
    }
}
