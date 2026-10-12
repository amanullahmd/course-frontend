package me.amanullah.course.certificate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.course.CefrLevel;
import me.amanullah.course.media.MediaDto;
import me.amanullah.course.user.UserSummaryDto;

public final class CertificateDtos {

    private CertificateDtos() {
    }

    /** Instructor view of a course's certificate settings (defaults when nothing was saved yet). */
    public record CertificateSettingsDto(UUID courseId, boolean enabled, int minProgressPercent,
                                         boolean requireAssessmentsPassed, Integer minAverageScore, boolean showScore,
                                         String title, CefrLevel level, CefrLevel courseLevel, String courseTitle,
                                         String signerName, String signerTitle, MediaDto signatureImage,
                                         String organization, String customText, CertificateLanguage language,
                                         String defaultSignerName, int issuedCount, Instant updatedAt) {
    }

    /** {@code title}, {@code level}, {@code minAverageScore} and the texts are optional ({@code null} = default). */
    public record CertificateSettingsUpdate(
            boolean enabled,
            @NotNull @Min(0) @Max(100) Integer minProgressPercent,
            boolean requireAssessmentsPassed,
            @Min(0) @Max(100) Integer minAverageScore,
            boolean showScore,
            @Size(max = 80) String title,
            CefrLevel level,
            @Size(max = 120) String signerName,
            @Size(max = 80) String signerTitle,
            UUID signatureImageId,
            @Size(max = 120) String organization,
            @Size(max = 400) String customText,
            @NotNull CertificateLanguage language) {
    }

    public enum CertificateState { ACTIVE, REVOKED }

    /**
     * A learner's certificate. {@code signerTitle}, {@code customText}, {@code showScore}, {@code signatureImageUrl}
     * and {@code language} (the PDF's default language, "en"/"de") let the frontend draw the same certificate.
     */
    public record CertificateDto(UUID id, String code, UUID courseId, String courseTitle, String learnerName,
                                 CefrLevel level, String title, Instant completedAt, Instant issuedAt,
                                 Double finalScore, String instructorName, String organization,
                                 CertificateState status, IssueType issueType, Instant revokedAt,
                                 String revokedReason, String verificationUrl, String signerTitle,
                                 String customText, boolean showScore, String signatureImageUrl,
                                 String language) {
    }

    /** Row of the instructor's certificate list. */
    public record InstructorCertificateDto(UUID id, String code, UserSummaryDto student, String learnerName,
                                           String courseTitle, CefrLevel level, Instant completedAt,
                                           Instant issuedAt, Double finalScore, CertificateState status,
                                           IssueType issueType, String issuedByName, Instant revokedAt,
                                           String revokedReason, String verificationUrl) {
    }

    public enum CriterionKey { PROGRESS, ASSESSMENTS_PASSED, AVERAGE_SCORE }

    /**
     * One completion requirement with the learner's current value: PROGRESS (percent vs. required percent),
     * ASSESSMENTS_PASSED (passed vs. total live quizzes/exams; {@code pending} awaiting grading) and AVERAGE_SCORE
     * (average best percent vs. the minimum).
     */
    public record CriterionDto(CriterionKey key, boolean met, Double current, Double target, int pending) {
    }

    public enum StatusKind { NOT_ENABLED, IN_PROGRESS, ISSUED, REVOKED }

    public record CertificateStatusDto(StatusKind status, boolean criteriaMet, List<CriterionDto> criteria,
                                       CertificateDto certificate) {
    }

    public record IssueRequest(@NotNull UUID studentId) {
    }

    public record RevokeRequest(@NotBlank @Size(max = 500) String reason) {
    }

    /** Public verification result; never contains e-mail addresses or internal ids. */
    public record VerificationDto(String code, boolean valid, boolean revoked, String learnerName,
                                  String courseTitle, CefrLevel level, String title, Instant completedAt,
                                  Instant issuedAt, Instant revokedAt, String instructorName, String organization) {
    }
}
