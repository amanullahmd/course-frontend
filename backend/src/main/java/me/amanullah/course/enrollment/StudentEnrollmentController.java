package me.amanullah.course.enrollment;

import me.amanullah.course.enrollment.EnrollmentDtos.ApplyRequest;
import me.amanullah.course.enrollment.EnrollmentDtos.EnrollmentDto;
import me.amanullah.course.enrollment.EnrollmentDtos.StudentEnrollmentDto;
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

@Tag(name = "Learner: enrollments")
@RestController
@RequestMapping("/api/student")
public class StudentEnrollmentController {

    private final EnrollmentService service;

    public StudentEnrollmentController(EnrollmentService service) {
        this.service = service;
    }

    @PostMapping("/courses/{courseId}/enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentDto apply(@PathVariable UUID courseId, @Valid @RequestBody(required = false) ApplyRequest request) {
        return service.apply(CurrentUser.get(), courseId, request == null ? null : request.message());
    }

    @GetMapping("/courses/{courseId}/enrollment")
    public EnrollmentDto mine(@PathVariable UUID courseId) {
        return service.mine(CurrentUser.get(), courseId);
    }

    @GetMapping("/enrollments")
    public List<StudentEnrollmentDto> myEnrollments() {
        return service.myEnrollments(CurrentUser.get());
    }

    @PostMapping("/enrollments/{id}/withdraw")
    public EnrollmentDto withdraw(@PathVariable UUID id) {
        return service.withdraw(CurrentUser.get(), id);
    }
}
