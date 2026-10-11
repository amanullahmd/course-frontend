package de.sprachweg.learning;

import de.sprachweg.learning.LearningDtos.LearnCourseDto;
import de.sprachweg.learning.LearningDtos.LearnItemDto;
import de.sprachweg.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: player")
@RestController
@RequestMapping("/api/student")
public class LearningController {

    private final LearningService service;

    public LearningController(LearningService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/learn")
    public LearnCourseDto learn(@PathVariable UUID courseId) {
        return service.course(CurrentUser.get(), courseId);
    }

    @GetMapping("/items/{itemId}")
    public LearnItemDto item(@PathVariable UUID itemId) {
        return service.item(CurrentUser.get(), itemId);
    }

    @PostMapping("/items/{itemId}/complete")
    public ResponseEntity<Void> complete(@PathVariable UUID itemId) {
        service.complete(CurrentUser.get(), itemId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{itemId}/complete")
    public ResponseEntity<Void> uncomplete(@PathVariable UUID itemId) {
        service.uncomplete(CurrentUser.get(), itemId);
        return ResponseEntity.noContent().build();
    }
}
