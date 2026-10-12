package me.amanullah.course.certificate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.certificate.CertificateDtos.CertificateDto;
import me.amanullah.course.certificate.CertificateDtos.CertificateStatusDto;
import me.amanullah.course.certificate.CertificateService.PdfFile;
import me.amanullah.course.media.FileNames;
import me.amanullah.course.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: certificates")
@RestController
@RequestMapping("/api/student")
public class StudentCertificateController {

    private final CertificateService service;

    public StudentCertificateController(CertificateService service) {
        this.service = service;
    }

    @Operation(summary = "My certificates (newest first, including revoked ones)")
    @GetMapping("/certificates")
    public List<CertificateDto> mine() {
        return service.mine(CurrentUser.get());
    }

    @Operation(summary = "Certificate status for a course: NOT_ENABLED, IN_PROGRESS (with criteria), ISSUED or REVOKED")
    @GetMapping("/courses/{courseId}/certificate")
    public CertificateStatusDto status(@PathVariable UUID courseId) {
        return service.status(CurrentUser.get(), courseId);
    }

    @Operation(summary = "My certificate as PDF (A4 landscape); lang=en|de overrides the course's language")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "application/pdf",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/certificates/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id, @RequestParam(required = false) String lang) {
        return pdf(service.studentPdf(CurrentUser.get(), id, lang));
    }

    static ResponseEntity<byte[]> pdf(PdfFile file) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, FileNames.contentDisposition(file.fileName(), true))
                .body(file.content());
    }
}
