package me.amanullah.course.certificate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import me.amanullah.course.course.CefrLevel;
import me.amanullah.course.media.MediaAsset;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Certificate configuration of one course (primary key = course id). */
@Entity
@Table(name = "certificate_settings")
public class CertificateSettings {

    public static final int DEFAULT_MIN_PROGRESS = 100;

    @Id
    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "min_progress_percent", nullable = false)
    private int minProgressPercent = DEFAULT_MIN_PROGRESS;

    @Column(name = "require_assessments_passed", nullable = false)
    private boolean requireAssessmentsPassed = true;

    @Column(name = "min_average_score")
    private Integer minAverageScore;

    @Column(name = "show_score", nullable = false)
    private boolean showScore = true;

    @Column(length = 80)
    private String title;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cefr_level", length = 2)
    private CefrLevel level;

    @Column(name = "signer_name", length = 120)
    private String signerName;

    @Column(name = "signer_title", length = 80)
    private String signerTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signature_image_id")
    private MediaAsset signatureImage;

    @Column(length = 120)
    private String organization;

    @Column(name = "custom_text", length = 400)
    private String customText;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cert_language", nullable = false, length = 10)
    private CertificateLanguage language = CertificateLanguage.LEARNER;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CertificateSettings() {
    }

    public CertificateSettings(UUID courseId, Instant now) {
        this.courseId = courseId;
        this.updatedAt = now;
    }

    /** Unsaved defaults for a course without a settings row. */
    public static CertificateSettings defaults(UUID courseId) {
        return new CertificateSettings(courseId, null);
    }

    public UUID getCourseId() { return courseId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getMinProgressPercent() { return minProgressPercent; }
    public void setMinProgressPercent(int minProgressPercent) { this.minProgressPercent = minProgressPercent; }
    public boolean isRequireAssessmentsPassed() { return requireAssessmentsPassed; }
    public void setRequireAssessmentsPassed(boolean v) { this.requireAssessmentsPassed = v; }
    public Integer getMinAverageScore() { return minAverageScore; }
    public void setMinAverageScore(Integer minAverageScore) { this.minAverageScore = minAverageScore; }
    public boolean isShowScore() { return showScore; }
    public void setShowScore(boolean showScore) { this.showScore = showScore; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public CefrLevel getLevel() { return level; }
    public void setLevel(CefrLevel level) { this.level = level; }
    public String getSignerName() { return signerName; }
    public void setSignerName(String signerName) { this.signerName = signerName; }
    public String getSignerTitle() { return signerTitle; }
    public void setSignerTitle(String signerTitle) { this.signerTitle = signerTitle; }
    public MediaAsset getSignatureImage() { return signatureImage; }
    public void setSignatureImage(MediaAsset signatureImage) { this.signatureImage = signatureImage; }
    public String getOrganization() { return organization; }
    public void setOrganization(String organization) { this.organization = organization; }
    public String getCustomText() { return customText; }
    public void setCustomText(String customText) { this.customText = customText; }
    public CertificateLanguage getLanguage() { return language; }
    public void setLanguage(CertificateLanguage language) { this.language = language; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
