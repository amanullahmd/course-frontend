package me.amanullah.course.admin;

import me.amanullah.course.admin.AdminDtos.AdminUserDto;
import me.amanullah.course.admin.AdminDtos.StatsDto;
import me.amanullah.course.admin.AdminDtos.UpdateUserRequest;
import me.amanullah.course.auth.RefreshTokenService;
import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.common.web.Paging;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {

    private final UserRepository users;
    private final CourseRepository courses;
    private final EnrollmentRepository enrollments;
    private final UserMapper userMapper;
    private final RefreshTokenService refreshTokens;
    private final Clock clock;

    public AdminService(UserRepository users, CourseRepository courses, EnrollmentRepository enrollments,
                        UserMapper userMapper, RefreshTokenService refreshTokens, Clock clock) {
        this.users = users;
        this.courses = courses;
        this.enrollments = enrollments;
        this.userMapper = userMapper;
        this.refreshTokens = refreshTokens;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public StatsDto stats() {
        return new StatsDto(users.count(), users.countByRole(Role.STUDENT), users.countByRole(Role.INSTRUCTOR),
                courses.count(), courses.countLive(Instant.now(clock)),
                enrollments.countByStatus(EnrollmentStatus.APPROVED));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserDto> users(String q, Role role, Integer page, Integer size) {
        String like = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
        return PageResponse.of(users.search(like, role, Paging.of(page, size, Sort.by("fullName").and(Sort.by("id")))),
                this::toDto);
    }

    @Transactional
    public AdminUserDto update(CurrentUser me, UUID id, UpdateUserRequest req) {
        User user = users.findById(id).orElseThrow(() -> NotFoundException.of("User"));
        boolean self = user.getId().equals(me.id());
        if (req.role() != null && req.role() != user.getRole()) {
            if (self) {
                throw new BadRequestException("CANNOT_MODIFY_SELF", "You cannot change your own role").key("error.CANNOT_MODIFY_SELF.role");
            }
            user.setRole(req.role());
        }
        if (req.enabled() != null && req.enabled() != user.isEnabled()) {
            if (self) {
                throw new BadRequestException("CANNOT_MODIFY_SELF", "You cannot disable your own account").key("error.CANNOT_MODIFY_SELF.disable");
            }
            user.setEnabled(req.enabled());
            if (!req.enabled()) {
                refreshTokens.revokeAll(user);
            }
        }
        return toDto(user);
    }

    private AdminUserDto toDto(User u) {
        var d = userMapper.toDto(u);
        return new AdminUserDto(d.id(), d.fullName(), d.email(), d.role(), d.emailVerified(), d.bio(), d.avatarUrl(),
                d.avatarMediaId(), d.locale(), d.createdAt(), u.isEnabled());
    }
}
