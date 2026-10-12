package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.AttemptResultDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSessionDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSummaryDto;
import me.amanullah.course.assessment.AssessmentDtos.SaveAnswersRequest;
import me.amanullah.course.assessment.AssessmentDtos.SubmitRequest;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: quizzes & exams")
@RestController
@RequestMapping("/api/student")
public class StudentAssessmentController {

    private final AttemptService attemptService;

    public StudentAssessmentController(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @GetMapping("/items/{itemId}/attempts")
    public List<AttemptSummaryDto> myAttempts(@PathVariable UUID itemId) {
        return attemptService.myAttempts(CurrentUser.get(), itemId);
    }

    /** Starts a new attempt or resumes the attempt in progress. */
    @PostMapping("/items/{itemId}/attempts")
    public AttemptSessionDto start(@PathVariable UUID itemId) {
        return attemptService.start(CurrentUser.get(), itemId);
    }

    /** Autosave of draft answers (no grading); 409 ATTEMPT_EXPIRED once the time is up. */
    @PutMapping("/attempts/{id}/answers")
    public ResponseEntity<Void> saveAnswers(@PathVariable UUID id, @Valid @RequestBody SaveAnswersRequest request) {
        attemptService.saveAnswers(CurrentUser.get(), id, request.answers());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/attempts/{id}/submit")
    public AttemptResultDto submit(@PathVariable UUID id, @Valid @RequestBody SubmitRequest request) {
        return attemptService.submit(CurrentUser.get(), id, request.answers());
    }

    @GetMapping("/attempts/{id}")
    public AttemptResultDto result(@PathVariable UUID id) {
        return attemptService.myResult(CurrentUser.get(), id);
    }
}
