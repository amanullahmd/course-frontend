package me.amanullah.course.admin;

import me.amanullah.course.admin.AdminDtos.AdminUserDto;
import me.amanullah.course.admin.AdminDtos.StatsDto;
import me.amanullah.course.admin.AdminDtos.UpdateUserRequest;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.admin.AdminDtos.InstructorDecisionRequest;
import me.amanullah.course.user.InstructorStatus;
import me.amanullah.course.user.Role;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

@Tag(name = "Admin")
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService service;

    public AdminController(AdminService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public StatsDto stats() {
        return service.stats();
    }

    @GetMapping("/users")
    public PageResponse<AdminUserDto> users(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) Role role,
                                            @RequestParam(required = false) InstructorStatus instructorStatus,
                                            @RequestParam(required = false) Integer page,
                                            @RequestParam(required = false) Integer size) {
        return service.users(q, role, instructorStatus, page, size);
    }

    /** Approves an instructor account (PENDING or REJECTED → APPROVED) and e-mails the instructor. */
    @PostMapping("/users/{id}/approve-instructor")
    public AdminUserDto approveInstructor(@PathVariable UUID id) {
        return service.decideInstructor(id, true, null);
    }

    /** Rejects an instructor account (→ REJECTED) with an optional reason and e-mails the instructor. */
    @PostMapping("/users/{id}/reject-instructor")
    public AdminUserDto rejectInstructor(@PathVariable UUID id,
                                         @Valid @RequestBody(required = false) InstructorDecisionRequest request) {
        return service.decideInstructor(id, false, request == null ? null : request.reason());
    }

    @PutMapping("/users/{id}")
    public AdminUserDto update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return service.update(CurrentUser.get(), id, request);
    }
}
