package me.amanullah.course.auth;

import me.amanullah.course.common.exception.UnauthorizedException;
import me.amanullah.course.common.util.Tokens;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.user.User;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Issues, rotates and revokes refresh tokens and builds the {@code refresh_token} cookie. */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    public static final String COOKIE_PATH = "/api/auth";

    private final RefreshTokenRepository repository;
    private final AppProperties props;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository repository, AppProperties props, Clock clock) {
        this.repository = repository;
        this.props = props;
        this.clock = clock;
    }

    /** Creates a new refresh token and returns its raw value (only the hash is persisted). */
    @Transactional
    public String issue(User user) {
        String raw = Tokens.random();
        Instant now = Instant.now(clock);
        repository.save(new RefreshToken(Tokens.sha256(raw), user, now, now.plus(props.jwt().refreshTokenTtl())));
        return raw;
    }

    public record Rotation(User user, String newToken) {
    }

    /**
     * Validates and rotates a refresh token. Presenting an already revoked token is treated as token theft:
     * every session of that user is revoked.
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public Rotation rotate(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "No refresh token");
        }
        Instant now = Instant.now(clock);
        RefreshToken token = repository.findByTokenHash(Tokens.sha256(raw))
                .orElseThrow(() -> new UnauthorizedException("INVALID_REFRESH_TOKEN", "Invalid refresh token"));
        User user = token.getUser();
        if (token.getRevokedAt() != null) {
            log.warn("Reuse of revoked refresh token detected for user {}; revoking all sessions", user.getId());
            repository.revokeAll(user, now, null);
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "Invalid refresh token");
        }
        if (!token.getExpiresAt().isAfter(now)) {
            throw new UnauthorizedException("REFRESH_TOKEN_EXPIRED", "Refresh token expired");
        }
        if (!user.isEnabled() || !user.isEmailVerified()) {
            token.setRevokedAt(now);
            throw new UnauthorizedException("ACCOUNT_DISABLED", "Account is not active");
        }
        token.setRevokedAt(now);
        return new Rotation(user, issue(user));
    }

    @Transactional
    public void revoke(String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        repository.findByTokenHash(Tokens.sha256(raw)).ifPresent(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(Instant.now(clock));
            }
        });
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void revokeAll(User user) {
        repository.revokeAll(user, Instant.now(clock), null);
    }

    /** Revokes all of the user's sessions except the one identified by the request's cookie. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void revokeAllExceptCurrent(User user, HttpServletRequest request) {
        String keep = readCookie(request).map(Tokens::sha256).orElse(null);
        repository.revokeAll(user, Instant.now(clock), keep);
    }

    public Optional<String> readCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        String name = props.auth().refreshCookieName();
        return Arrays.stream(cookies).filter(c -> name.equals(c.getName())).map(Cookie::getValue).findFirst();
    }

    public ResponseCookie cookie(String value) {
        return baseCookie(value).maxAge(props.jwt().refreshTokenTtl()).build();
    }

    public ResponseCookie clearCookie() {
        return baseCookie("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(props.auth().refreshCookieName(), value)
                .httpOnly(true)
                .secure(props.auth().secureCookie())
                .sameSite(props.auth().cookieSameSite())
                .path(COOKIE_PATH);
    }

    /** Housekeeping: drop refresh tokens that expired more than a day ago. */
    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purgeExpired() {
        int n = repository.deleteExpired(Instant.now(clock).minus(Duration.ofDays(1)));
        if (n > 0) {
            log.info("Purged {} expired refresh tokens", n);
        }
    }
}
