package de.sprachweg.admin;

import de.sprachweg.admin.AdminDtos.AdminUserDto;
import de.sprachweg.admin.AdminDtos.StatsDto;
import de.sprachweg.admin.AdminDtos.UpdateUserRequest;
import de.sprachweg.common.web.PageResponse;
import de.sprachweg.security.CurrentUser;
import de.sprachweg.user.Role;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
                                            @RequestParam(required = false) Integer page,
                                            @RequestParam(required = false) Integer size) {
        return service.users(q, role, page, size);
    }

    @PutMapping("/users/{id}")
    public AdminUserDto update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return service.update(CurrentUser.get(), id, request);
    }
}
