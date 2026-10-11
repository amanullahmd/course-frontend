package de.sprachweg.auth;

import de.sprachweg.common.exception.UnauthorizedException;
import de.sprachweg.common.web.MessageResponse;
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

    public AuthController(AuthService authService, RefreshTokenService refreshTokens) {
        this.authService = authService;
        this.refreshTokens = refreshTokens;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        authService.register(request);
        return new MessageResponse("Registration successful. Please check your e-mail to verify your account.");
    }

    @PostMapping("/verify-email")
    public MessageResponse verifyEmail(@Valid @RequestBody AuthDtos.TokenRequest request) {
        authService.verifyEmail(request.token());
        return new MessageResponse("Your e-mail address has been verified. You can now log in.");
    }

    @PostMapping("/resend-verification")
    public MessageResponse resend(@Valid @RequestBody AuthDtos.EmailRequest request) {
        authService.resendVerification(request.email());
        return new MessageResponse(GENERIC_MAIL_MESSAGE);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request) {
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
    public MessageResponse forgotPassword(@Valid @RequestBody AuthDtos.EmailRequest request) {
        authService.forgotPassword(request.email());
        return new MessageResponse(GENERIC_MAIL_MESSAGE);
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.password());
        return new MessageResponse("Your password has been changed. You can now log in.");
    }
}
