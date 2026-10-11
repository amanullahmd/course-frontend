package de.sprachweg.assessment;

import de.sprachweg.assessment.AssessmentDtos.AssessmentDto;
import de.sprachweg.assessment.AssessmentDtos.AssessmentUpsert;
import de.sprachweg.assessment.AssessmentDtos.AttemptResultDto;
import de.sprachweg.assessment.AssessmentDtos.AttemptSummaryDto;
import de.sprachweg.assessment.AssessmentDtos.GradeRequest;
import de.sprachweg.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructor: assessments")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorAssessmentController {

    private final AssessmentService assessmentService;
    private final AttemptService attemptService;

    public InstructorAssessmentController(AssessmentService assessmentService, AttemptService attemptService) {
        this.assessmentService = assessmentService;
        this.attemptService = attemptService;
    }

    @GetMapping("/items/{id}/assessment")
    public AssessmentDto get(@PathVariable UUID id) {
        return assessmentService.get(CurrentUser.get(), id);
    }

    @PutMapping("/items/{id}/assessment")
    public AssessmentDto replace(@PathVariable UUID id, @Valid @RequestBody AssessmentUpsert request) {
        return assessmentService.replace(CurrentUser.get(), id, request);
    }

    @GetMapping("/items/{id}/attempts")
    public List<AttemptSummaryDto> attempts(@PathVariable UUID id) {
        return attemptService.attemptsForItem(CurrentUser.get(), id);
    }

    @GetMapping("/attempts/{id}")
    public AttemptResultDto attempt(@PathVariable UUID id) {
        return attemptService.instructorView(CurrentUser.get(), id);
    }

    @PostMapping("/attempts/{id}/grade")
    public AttemptResultDto grade(@PathVariable UUID id, @Valid @RequestBody GradeRequest request) {
        return attemptService.grade(CurrentUser.get(), id, request.grades());
    }
}
