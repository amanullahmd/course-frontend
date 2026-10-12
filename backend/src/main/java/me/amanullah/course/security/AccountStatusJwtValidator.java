package me.amanullah.course.security;

import java.util.UUID;
import me.amanullah.course.user.UserRepository;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Rejects otherwise valid access tokens whose account was disabled or deleted, or whose role changed after the
 * token was issued. Without this check a disabled user (or a demoted instructor) keeps full access until the
 * short-lived token expires. The client answers the resulting 401 with a refresh, which fails for disabled
 * accounts (their refresh tokens are revoked) and yields a token with the new role otherwise.
 */
class AccountStatusJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2TokenValidatorResult INACTIVE = OAuth2TokenValidatorResult.failure(
            new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "The account is no longer active", null));
    private static final OAuth2TokenValidatorResult STALE_ROLE = OAuth2TokenValidatorResult.failure(
            new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "The account role has changed", null));

    private final UserRepository users;

    AccountStatusJwtValidator(UserRepository users) {
        this.users = users;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null) {
            return INACTIVE;
        }
        UUID id;
        try {
            id = UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            return INACTIVE;
        }
        return users.findAccountState(id)
                .map(state -> {
                    if (!state.enabled()) {
                        return INACTIVE;
                    }
                    if (!state.role().name().equals(jwt.getClaimAsString(JwtService.CLAIM_ROLE))) {
                        return STALE_ROLE;
                    }
                    return OAuth2TokenValidatorResult.success();
                })
                .orElse(INACTIVE);
    }
}
