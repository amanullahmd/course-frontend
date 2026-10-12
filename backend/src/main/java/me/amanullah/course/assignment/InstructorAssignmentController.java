package me.amanullah.course.assignment;

import me.amanullah.course.assignment.AssignmentDtos.AssignmentDto;
import me.amanullah.course.assignment.AssignmentDtos.AssignmentUpsert;
import me.amanullah.course.assignment.AssignmentDtos.ReviewRequest;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionDetailDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionSummaryDto;
import me.amanullah.course.security.CurrentUser;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructor: assignments")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorAssignmentController {

    private final AssignmentService assignments;
    private final SubmissionService submissions;

    public InstructorAssignmentController(AssignmentService assignments, SubmissionService submissions) {
        this.assignments = assignments;
        this.submissions = submissions;
    }

    @GetMapping("/items/{id}/assignment")
    public AssignmentDto get(@PathVariable UUID id) {
        return assignments.get(CurrentUser.get(), id);
    }

    @PutMapping("/items/{id}/assignment")
    public AssignmentDto replace(@PathVariable UUID id, @Valid @RequestBody AssignmentUpsert request) {
        return assignments.replace(CurrentUser.get(), id, request);
    }

    /** Latest version per learner, newest first. */
    @GetMapping("/items/{id}/submissions")
    public List<SubmissionSummaryDto> forItem(@PathVariable UUID id,
                                              @RequestParam(required = false) SubmissionStatus status) {
        return submissions.forItem(CurrentUser.get(), id, status);
    }

    /** Review queue over all assignments of a course. */
    @GetMapping("/courses/{courseId}/submissions")
    public List<SubmissionSummaryDto> forCourse(@PathVariable UUID courseId,
                                                @RequestParam(required = false) SubmissionStatus status) {
        return submissions.forCourse(CurrentUser.get(), courseId, status);
    }

    @GetMapping("/submissions/{id}")
    public SubmissionDetailDto detail(@PathVariable UUID id) {
        return submissions.detail(CurrentUser.get(), id);
    }

    @PostMapping("/submissions/{id}/review")
    public SubmissionDetailDto review(@PathVariable UUID id, @Valid @RequestBody ReviewRequest request) {
        return submissions.review(CurrentUser.get(), id, request);
    }
}
