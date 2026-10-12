package me.amanullah.course.auth;

import me.amanullah.course.common.exception.UnauthorizedException;
import me.amanullah.course.common.web.MessageResponse;
import me.amanullah.course.security.RateLimiter;
import me.amanullah.course.security.RateLimiter.Limit;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String GENERIC_MAIL_MESSAGE =
            "If an account exists for this address, we have sent you an e-mail.";

    private final AuthService authService;
    private final RefreshTokenService refreshTokens;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService authService, RefreshTokenService refreshTokens, RateLimiter rateLimiter) {
        this.authService = authService;
        this.refreshTokens = refreshTokens;
        this.rateLimiter = rateLimiter;
    }

    /*
     * Rate limits (429 RATE_LIMITED + Retry-After, see RateLimiter): checked after bean validation, before any
     * database access. Limits keyed by e-mail apply to unknown addresses too, so they reveal nothing about accounts.
     */

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request, HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.REGISTER_IP, http);
        authService.register(request);
        return new MessageResponse("Registration successful. Please check your e-mail to verify your account.");
    }

    @PostMapping("/verify-email")
    public MessageResponse verifyEmail(@Valid @RequestBody AuthDtos.TokenRequest request, HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.TOKEN_IP, http);
        authService.verifyEmail(request.token());
        return new MessageResponse("Your e-mail address has been verified. You can now log in.");
    }

    @PostMapping("/resend-verification")
    public MessageResponse resend(@Valid @RequestBody AuthDtos.EmailRequest request, HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.MAIL_IP, http);
        rateLimiter.consumeEmail(Limit.MAIL_EMAIL, "resend:" + request.email());
        authService.resendVerification(request.email());
        return new MessageResponse(GENERIC_MAIL_MESSAGE);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                                       HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.LOGIN_IP, http);
        rateLimiter.consumeEmail(Limit.LOGIN_EMAIL, request.email());
        AuthService.LoginResult result = authService.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.cookie(result.refreshToken()).toString())
                .body(result.response());
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthDtos.AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        try {
            AuthService.LoginResult result = authService.refresh(refreshTokens.readCookie(request).orElse(null));
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshTokens.cookie(result.refreshToken()).toString())
                    .body(result.response());
        } catch (UnauthorizedException e) {
            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokens.clearCookie().toString());
            throw e;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(refreshTokens.readCookie(request).orElse(null));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.clearCookie().toString())
                .build();
    }

    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody AuthDtos.EmailRequest request, HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.MAIL_IP, http);
        rateLimiter.consumeEmail(Limit.MAIL_EMAIL, "reset:" + request.email());
        authService.forgotPassword(request.email());
        return new MessageResponse(GENERIC_MAIL_MESSAGE);
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request,
                                         HttpServletRequest http) {
        rateLimiter.consumeIp(Limit.TOKEN_IP, http);
        authService.resetPassword(request.token(), request.password());
        return new MessageResponse("Your password has been changed. You can now log in.");
    }
}
