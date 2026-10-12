package me.amanullah.course.assignment;

import me.amanullah.course.assignment.AssignmentDtos.LearnerAssignmentDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmitRequest;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: assignments")
@RestController
@RequestMapping("/api/student/items/{itemId}")
public class StudentAssignmentController {

    private final AssignmentService assignments;
    private final SubmissionService submissions;

    public StudentAssignmentController(AssignmentService assignments, SubmissionService submissions) {
        this.assignments = assignments;
        this.submissions = submissions;
    }

    @GetMapping("/assignment")
    public LearnerAssignmentDto assignment(@PathVariable UUID itemId) {
        return assignments.learnerView(CurrentUser.get(), itemId);
    }

    /** My submissions, all versions, oldest first. */
    @GetMapping("/submissions")
    public List<SubmissionDto> mine(@PathVariable UUID itemId) {
        return submissions.mine(CurrentUser.get(), itemId);
    }

    @PostMapping("/submissions")
    @ResponseStatus(HttpStatus.CREATED)
    public SubmissionDto submit(@PathVariable UUID itemId, @Valid @RequestBody SubmitRequest request) {
        return submissions.submit(CurrentUser.get(), itemId, request);
    }
}
