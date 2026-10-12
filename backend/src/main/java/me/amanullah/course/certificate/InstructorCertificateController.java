package me.amanullah.course.certificate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.certificate.CertificateDtos.CertificateSettingsDto;
import me.amanullah.course.certificate.CertificateDtos.CertificateSettingsUpdate;
import me.amanullah.course.certificate.CertificateDtos.InstructorCertificateDto;
import me.amanullah.course.certificate.CertificateDtos.IssueRequest;
import me.amanullah.course.certificate.CertificateDtos.RevokeRequest;
import me.amanullah.course.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Certificate settings, issued certificates, manual issue and revocation (course owner or admin; others → 404). */
@Tag(name = "Instructor: certificates")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorCertificateController {

    private final CertificateService service;

    public InstructorCertificateController(CertificateService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/certificate-settings")
    public CertificateSettingsDto settings(@PathVariable UUID courseId) {
        return service.settings(CurrentUser.get(), courseId);
    }

    @PutMapping("/courses/{courseId}/certificate-settings")
    public CertificateSettingsDto updateSettings(@PathVariable UUID courseId,
                                                 @Valid @RequestBody CertificateSettingsUpdate body) {
        return service.updateSettings(CurrentUser.get(), courseId, body);
    }

    @Operation(summary = "Issued certificates of a course (newest first), optionally filtered by name, e-mail or code")
    @GetMapping("/courses/{courseId}/certificates")
    public List<InstructorCertificateDto> list(@PathVariable UUID courseId, @RequestParam(required = false) String q) {
        return service.list(CurrentUser.get(), courseId, q);
    }

    @Operation(summary = "Issue a certificate manually (override), also when the learner does not meet the criteria")
    @PostMapping("/courses/{courseId}/certificates/issue")
    public InstructorCertificateDto issue(@PathVariable UUID courseId, @Valid @RequestBody IssueRequest body) {
        return service.issueManually(CurrentUser.get(), courseId, body.studentId());
    }

    @PostMapping("/certificates/{id}/revoke")
    public InstructorCertificateDto revoke(@PathVariable UUID id, @Valid @RequestBody RevokeRequest body) {
        return service.revoke(CurrentUser.get(), id, body.reason());
    }

    @Operation(summary = "Certificate as PDF (A4 landscape); revoked certificates carry a stamp")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "application/pdf",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/certificates/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id, @RequestParam(required = false) String lang) {
        return StudentCertificateController.pdf(service.instructorPdf(CurrentUser.get(), id, lang));
    }
}
