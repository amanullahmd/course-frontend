package me.amanullah.course.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.user.InstructorStatus;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.UserRepository;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Instructors whose account has not been approved by an admin (PENDING or REJECTED) may read the instructor area
 * (it is empty for them) but every write under {@code /api/instructor/**} (create, edit, publish courses …) is
 * refused with 403 {@code INSTRUCTOR_NOT_APPROVED}. The status is read from the database, so an approval takes effect
 * immediately without a new token.
 */
@Component
public class InstructorApprovalInterceptor implements HandlerInterceptor {

    public static final String PATTERN = "/api/instructor/**";

    private final UserRepository users;

    public InstructorApprovalInterceptor(UserRepository users) {
        this.users = users;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String method = request.getMethod();
        if (HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method) || HttpMethod.OPTIONS.matches(method)) {
            return true;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)
                || !Role.INSTRUCTOR.name().equals(jwt.getClaimAsString(JwtService.CLAIM_ROLE))) {
            return true;
        }
        CurrentUser me = CurrentUser.get();
        InstructorStatus status = users.findInstructorStatus(me.id()).orElse(null);
        if (status != null && status != InstructorStatus.APPROVED) {
            throw new ForbiddenException("INSTRUCTOR_NOT_APPROVED", "Your instructor account has not been approved yet")
                    .key(status == InstructorStatus.REJECTED
                            ? "error.INSTRUCTOR_NOT_APPROVED.rejected" : "error.INSTRUCTOR_NOT_APPROVED");
        }
        return true;
    }
}
