package me.amanullah.course.certificate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import me.amanullah.course.certificate.CertificateDtos.VerificationDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Public: certificate verification")
@RestController
@RequestMapping("/api/public/certificates")
public class PublicCertificateController {

    private final CertificateService service;
    private final VerificationRateLimiter limiter;

    public PublicCertificateController(CertificateService service, VerificationRateLimiter limiter) {
        this.service = service;
        this.limiter = limiter;
    }

    @Operation(summary = "Verify a certificate code (no personal data beyond the name on the certificate); "
            + "unknown codes → 404 CERTIFICATE_NOT_FOUND, too many lookups → 429 RATE_LIMITED")
    @GetMapping("/{code}")
    public VerificationDto verify(@PathVariable String code, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr());
        return service.verify(code);
    }
}
