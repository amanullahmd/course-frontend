package me.amanullah.course.privacy;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import me.amanullah.course.auth.RefreshTokenService;
import me.amanullah.course.media.FileNames;
import me.amanullah.course.privacy.PrivacyDtos.DeleteAccountRequest;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.security.RateLimiter;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Data subject rights of the signed-in user: data export and account deletion. */
@Tag(name = "Me")
@RestController
@RequestMapping("/api/users/me")
public class PrivacyController {

    private final AccountDeletionService deletion;
    private final DataExportService export;
    private final RefreshTokenService refreshTokens;
    private final RateLimiter rateLimiter;
    private final Clock clock;

    public PrivacyController(AccountDeletionService deletion, DataExportService export,
                             RefreshTokenService refreshTokens, RateLimiter rateLimiter, Clock clock) {
        this.deletion = deletion;
        this.export = export;
        this.refreshTokens = refreshTokens;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
    }

    /**
     * Deletes (anonymises) the account. Requires the password and {@code confirm: "DELETE"}. 409 HAS_COURSES while
     * the user owns courses, 409 LAST_ADMIN for the last admin. Clears the refresh cookie.
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(@Valid @RequestBody DeleteAccountRequest request) {
        UUID me = CurrentUser.get().id();
        rateLimiter.consumeUser(RateLimiter.Limit.DELETE_ACCOUNT_USER, me);
        deletion.deleteOwnAccount(me, request.password(), request.confirm());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.clearCookie().toString())
                .build();
    }

    /** ZIP of all personal data and uploads (streamed). Rate limited (default 3 per day). */
    @GetMapping("/export")
    @Operation(responses = @ApiResponse(responseCode = "200", description = "ZIP archive",
            content = @Content(mediaType = "application/zip", schema = @Schema(type = "string", format = "binary"))))
    public void exportData(HttpServletResponse response) throws IOException {
        UUID me = CurrentUser.get().id();
        rateLimiter.consumeUser(RateLimiter.Limit.EXPORT_USER, me);
        DataExportService.Export data = export.collect(me);
        String name = "sprachweg-data-" + LocalDate.now(clock.withZone(ZoneOffset.UTC)) + ".zip";
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, FileNames.contentDisposition(name, true));
        response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        export.writeZip(data, response.getOutputStream());
        response.flushBuffer();
    }
}
