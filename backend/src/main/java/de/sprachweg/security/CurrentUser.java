package de.sprachweg.security;

import de.sprachweg.common.exception.UnauthorizedException;
import de.sprachweg.user.Role;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** The authenticated principal as extracted from the access token. */
public record CurrentUser(UUID id, String email, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public static CurrentUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new UnauthorizedException("Authentication required");
        }
        return new CurrentUser(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString(JwtService.CLAIM_EMAIL),
                Role.valueOf(jwt.getClaimAsString(JwtService.CLAIM_ROLE)));
    }
}
