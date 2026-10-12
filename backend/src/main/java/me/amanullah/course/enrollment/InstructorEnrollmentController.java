package me.amanullah.course.enrollment;

import me.amanullah.course.enrollment.EnrollmentDtos.AddStudentsRequest;
import me.amanullah.course.enrollment.EnrollmentDtos.AddStudentsResult;
import me.amanullah.course.enrollment.EnrollmentDtos.BulkRequest;
import me.amanullah.course.enrollment.EnrollmentDtos.EnrollmentDto;
import me.amanullah.course.enrollment.EnrollmentDtos.ReasonRequest;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructor: enrollments")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorEnrollmentController {

    private final EnrollmentService service;

    public InstructorEnrollmentController(EnrollmentService service) {
        this.service = service;
    }

    /** PENDING entries are ordered by application time (waiting list). */
    @GetMapping("/courses/{id}/enrollments")
    public List<EnrollmentDto> list(@PathVariable UUID id, @RequestParam(required = false) EnrollmentStatus status) {
        return service.forCourse(CurrentUser.get(), id, status);
    }

    @PostMapping("/enrollments/{id}/approve")
    public EnrollmentDto approve(@PathVariable UUID id) {
        return service.approve(CurrentUser.get(), id);
    }

    @PostMapping("/enrollments/{id}/reject")
    public EnrollmentDto reject(@PathVariable UUID id, @Valid @RequestBody(required = false) ReasonRequest request) {
        return service.reject(CurrentUser.get(), id, request == null ? null : request.reason());
    }

    @PostMapping("/enrollments/{id}/revoke")
    public EnrollmentDto revoke(@PathVariable UUID id, @Valid @RequestBody(required = false) ReasonRequest request) {
        return service.revoke(CurrentUser.get(), id, request == null ? null : request.reason());
    }

    /** Approves/restores, rejects or removes (REVOKE) many enrollments at once, all or nothing. */
    @PostMapping("/enrollments/bulk")
    public List<EnrollmentDto> bulk(@Valid @RequestBody BulkRequest request) {
        return service.bulk(CurrentUser.get(), request.ids(), request.action(), request.reason(), request.courseId());
    }

    /** Adds learners by e-mail address (course owner or admin); see {@link AddStudentsResult}. */
    @PostMapping("/courses/{courseId}/enrollments/add")
    public AddStudentsResult add(@PathVariable UUID courseId, @Valid @RequestBody AddStudentsRequest request) {
        return service.addStudents(CurrentUser.get(), courseId, request);
    }
}
