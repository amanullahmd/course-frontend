package me.amanullah.course.auth;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.common.exception.UnauthorizedException;
import me.amanullah.course.common.i18n.I18nConfig;
import me.amanullah.course.common.util.Tokens;
import org.springframework.context.i18n.LocaleContextHolder;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.MessageRef;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.config.RegistrationProperties;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.MailService;
import me.amanullah.course.security.JwtService;
import me.amanullah.course.user.InstructorStatus;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    /** Used to keep login timing similar for unknown e-mails (avoid user enumeration by timing). */
    private final String dummyHash;

    private final UserRepository users;
    private final VerificationTokenRepository tokens;
    private final RefreshTokenService refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserMapper userMapper;
    private final MailService mail;
    private final EmailTemplates templates;
    private final AppProperties props;
    private final RegistrationProperties registration;
    private final Clock clock;

    public AuthService(UserRepository users, VerificationTokenRepository tokens, RefreshTokenService refreshTokens,
                       PasswordEncoder passwordEncoder, JwtService jwtService, UserMapper userMapper, MailService mail,
                       EmailTemplates templates, AppProperties props, RegistrationProperties registration,
                       Clock clock) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userMapper = userMapper;
        this.mail = mail;
        this.templates = templates;
        this.props = props;
        this.registration = registration;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("timing-equalizer-" + Tokens.random());
    }

    public record LoginResult(AuthDtos.AuthResponse response, String refreshToken) {
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public void register(AuthDtos.RegisterRequest req) {
        if (req.role() != Role.STUDENT && req.role() != Role.INSTRUCTOR) {
            throw new BadRequestException("INVALID_ROLE", "Role must be STUDENT or INSTRUCTOR");
        }
        boolean termsAccepted = Boolean.TRUE.equals(req.acceptTerms());
        if (registration.termsRequired() && !termsAccepted) {
            throw new ValidationException(Map.of("acceptTerms", new MessageRef("validation.acceptTerms")));
        }
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("EMAIL_TAKEN", "An account with this e-mail address already exists");
        }
        User newUser = new User(req.fullName().trim(), email, passwordEncoder.encode(req.password()), req.role());
        newUser.setLocale(req.locale() != null ? req.locale() : I18nConfig.toTag(LocaleContextHolder.getLocale()));
        if (req.role() == Role.INSTRUCTOR && registration.instructorApprovalRequired()) {
            newUser.setInstructorStatus(InstructorStatus.PENDING);
        }
        if (termsAccepted) {
            newUser.setTermsAcceptedAt(Instant.now(clock));
        }
        User user = users.save(newUser);
        sendVerification(user);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        VerificationToken token = consume(rawToken, TokenType.EMAIL_VERIFY);
        token.getUser().setEmailVerified(true);
    }

    @Transactional
    public void resendVerification(String email) {
        users.findByEmailIgnoreCase(normalizeEmail(email))
                .filter(u -> !u.isEmailVerified() && u.isEnabled())
                .ifPresent(this::sendVerification);
    }

    @Transactional
    public LoginResult login(AuthDtos.LoginRequest req) {
        User user = users.findByEmailIgnoreCase(normalizeEmail(req.email())).orElse(null);
        if (user == null) {
            passwordEncoder.matches(req.password(), dummyHash);
            throw invalidCredentials();
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        if (!user.isEnabled()) {
            throw new ForbiddenException("ACCOUNT_DISABLED", "This account has been disabled");
        }
        if (!user.isEmailVerified()) {
            throw new ForbiddenException("EMAIL_NOT_VERIFIED", "Please verify your e-mail address before logging in");
        }
        return tokensFor(user, refreshTokens.issue(user));
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public LoginResult refresh(String rawRefreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(rawRefreshToken);
        return tokensFor(rotation.user(), rotation.newToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.revoke(rawRefreshToken);
    }

    @Transactional
    public void forgotPassword(String email) {
        users.findByEmailIgnoreCase(normalizeEmail(email)).filter(User::isEnabled).ifPresent(user -> {
            String raw = createToken(user, TokenType.PASSWORD_RESET, props.auth().passwordResetTtl());
            String link = props.frontendUrl() + "/reset-password?token=" + raw;
            mail.send(user.getEmail(), templates.passwordReset(user, link));
        });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        VerificationToken token = consume(rawToken, TokenType.PASSWORD_RESET);
        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        // The reset link proves ownership of the mailbox.
        user.setEmailVerified(true);
        refreshTokens.revokeAll(user);
    }

    private LoginResult tokensFor(User user, String refreshToken) {
        AuthDtos.AuthResponse response = new AuthDtos.AuthResponse(jwtService.issueAccessToken(user),
                jwtService.accessTokenTtlSeconds(), userMapper.toDto(user));
        return new LoginResult(response, refreshToken);
    }

    private void sendVerification(User user) {
        String raw = createToken(user, TokenType.EMAIL_VERIFY, props.auth().emailVerificationTtl());
        String link = props.frontendUrl() + "/verify-email?token=" + raw;
        mail.send(user.getEmail(), templates.verifyEmail(user, link));
    }

    private String createToken(User user, TokenType type, Duration ttl) {
        Instant now = Instant.now(clock);
        tokens.invalidateAll(user, type, now);
        String raw = Tokens.random();
        tokens.save(new VerificationToken(raw, user, type, now, now.plus(ttl)));
        return raw;
    }

    private VerificationToken consume(String raw, TokenType type) {
        Instant now = Instant.now(clock);
        VerificationToken token = tokens.findByTokenAndType(raw, type)
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "The link is invalid"));
        if (token.getUsedAt() != null) {
            throw new BadRequestException("TOKEN_USED", "The link has already been used");
        }
        if (!token.getExpiresAt().isAfter(now)) {
            throw new BadRequestException("TOKEN_EXPIRED", "The link has expired");
        }
        token.setUsedAt(now);
        return token;
    }

    private static UnauthorizedException invalidCredentials() {
        return new UnauthorizedException("INVALID_CREDENTIALS", "E-mail or password is incorrect");
    }
}
