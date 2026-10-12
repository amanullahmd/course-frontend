package me.amanullah.course.certificate;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import me.amanullah.course.certificate.CertificateDtos.CertificateDto;
import me.amanullah.course.certificate.CertificateDtos.CertificateSettingsDto;
import me.amanullah.course.certificate.CertificateDtos.CertificateSettingsUpdate;
import me.amanullah.course.certificate.CertificateDtos.CertificateState;
import me.amanullah.course.certificate.CertificateDtos.CertificateStatusDto;
import me.amanullah.course.certificate.CertificateDtos.InstructorCertificateDto;
import me.amanullah.course.certificate.CertificateDtos.StatusKind;
import me.amanullah.course.certificate.CertificateDtos.VerificationDto;
import me.amanullah.course.certificate.CertificatePdfRenderer.PdfModel;
import me.amanullah.course.certificate.CompletionEvaluator.Evaluation;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.I18nConfig;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.media.FileStorage;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Course completion certificates: per-course settings, automatic issuing when a learner meets the criteria
 * (idempotent: at most one active certificate per learner and course, enforced by a unique constraint), manual
 * issuing and revocation by the instructor, PDF rendering and public verification.
 */
@Service
public class CertificateService {

    private static final Logger log = LoggerFactory.getLogger(CertificateService.class);
    private static final Set<String> SIGNATURE_TYPES = Set.of("image/png", "image/jpeg", "image/gif");
    private static final int PDF_CACHE_SIZE = 64;

    private final CertificateRepository certificates;
    private final CertificateSettingsRepository settingsRepository;
    private final CompletionEvaluator evaluator;
    private final CertificatePdfRenderer renderer;
    private final CourseAccess courseAccess;
    private final LearnerAccess learnerAccess;
    private final CourseRepository courses;
    private final EnrollmentRepository enrollments;
    private final UserRepository users;
    private final MediaService mediaService;
    private final MediaMapper mediaMapper;
    private final UserMapper userMapper;
    private final FileStorage storage;
    private final NotificationService notifications;
    private final EmailTemplates templates;
    private final Messages messages;
    private final AppProperties props;
    private final Clock clock;
    private final TransactionTemplate newTx;
    private final Map<String, byte[]> pdfCache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
                    return size() > PDF_CACHE_SIZE;
                }
            });

    public CertificateService(CertificateRepository certificates, CertificateSettingsRepository settingsRepository,
                              CompletionEvaluator evaluator, CertificatePdfRenderer renderer,
                              CourseAccess courseAccess, LearnerAccess learnerAccess, CourseRepository courses,
                              EnrollmentRepository enrollments, UserRepository users, MediaService mediaService,
                              MediaMapper mediaMapper, UserMapper userMapper, FileStorage storage,
                              NotificationService notifications, EmailTemplates templates, Messages messages,
                              AppProperties props, Clock clock, PlatformTransactionManager txManager) {
        this.certificates = certificates;
        this.settingsRepository = settingsRepository;
        this.evaluator = evaluator;
        this.renderer = renderer;
        this.courseAccess = courseAccess;
        this.learnerAccess = learnerAccess;
        this.courses = courses;
        this.enrollments = enrollments;
        this.users = users;
        this.mediaService = mediaService;
        this.mediaMapper = mediaMapper;
        this.userMapper = userMapper;
        this.storage = storage;
        this.notifications = notifications;
        this.templates = templates;
        this.messages = messages;
        this.props = props;
        this.clock = clock;
        this.newTx = new TransactionTemplate(txManager);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Frontend path of the learner's certificate page inside the course player. */
    public static String learnerLink(UUID courseId) {
        return "/learn/" + courseId + "/certificate";
    }

    public String verificationUrl(String code) {
        return props.frontendUrl() + "/certificates/verify/" + code;
    }

    // ------------------------------------------------------------------------------------------------------------
    // Settings (instructor)
    // ------------------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public CertificateSettingsDto settings(CurrentUser me, UUID courseId) {
        Course course = courseAccess.course(courseId, me);
        return toSettingsDto(course, settingsOf(courseId));
    }

    @Transactional
    public CertificateSettingsDto updateSettings(CurrentUser me, UUID courseId, CertificateSettingsUpdate body) {
        Course course = courseAccess.course(courseId, me);
        Instant now = Instant.now(clock);
        CertificateSettings s = settingsRepository.findById(courseId)
                .orElseGet(() -> new CertificateSettings(courseId, now));
        MediaAsset signature = null;
        if (body.signatureImageId() != null) {
            try {
                signature = mediaService.requireUsable(body.signatureImageId(), me.id(), me.isAdmin());
            } catch (NotFoundException e) {
                throw ValidationException.field("signatureImageId", "validation.certificate.signatureImage");
            }
            if (signature.getKind() != MediaKind.IMAGE
                    || !SIGNATURE_TYPES.contains(signature.getContentType().toLowerCase(Locale.ROOT))) {
                throw ValidationException.field("signatureImageId", "validation.certificate.signatureImage");
            }
        }
        s.setEnabled(body.enabled());
        s.setMinProgressPercent(body.minProgressPercent());
        s.setRequireAssessmentsPassed(body.requireAssessmentsPassed());
        s.setMinAverageScore(body.minAverageScore());
        s.setShowScore(body.showScore());
        s.setTitle(trim(body.title()));
        s.setLevel(body.level());
        s.setSignerName(trim(body.signerName()));
        s.setSignerTitle(trim(body.signerTitle()));
        s.setSignatureImage(signature);
        s.setOrganization(trim(body.organization()));
        s.setCustomText(trim(body.customText()));
        s.setLanguage(body.language());
        s.setUpdatedAt(now);
        settingsRepository.save(s);
        if (s.isEnabled()) {
            // Learners who already meet the (new) criteria get their certificate right away.
            for (Enrollment e : enrollments.findByCourse(courseId, EnrollmentStatus.APPROVED)) {
                issueIfEligible(course, s, e.getStudent(), now);
            }
        }
        return toSettingsDto(course, s);
    }

    private CertificateSettings settingsOf(UUID courseId) {
        return settingsRepository.findById(courseId).orElseGet(() -> CertificateSettings.defaults(courseId));
    }

    private CertificateSettingsDto toSettingsDto(Course course, CertificateSettings s) {
        int issued = (int) certificates.findByCourse(course.getId()).stream().filter(c -> !c.isRevoked()).count();
        return new CertificateSettingsDto(course.getId(), s.isEnabled(), s.getMinProgressPercent(),
                s.isRequireAssessmentsPassed(), s.getMinAverageScore(), s.isShowScore(), s.getTitle(), s.getLevel(),
                course.getLevel(), course.getTitle(), s.getSignerName(), s.getSignerTitle(),
                mediaMapper.toDto(s.getSignatureImage()), s.getOrganization(), s.getCustomText(), s.getLanguage(),
                course.getInstructor().getFullName(), issued, s.getUpdatedAt());
    }

    // ------------------------------------------------------------------------------------------------------------
    // Issuing
    // ------------------------------------------------------------------------------------------------------------

    /**
     * Issues the certificate when certificates are enabled, the learner has an approved enrollment, has never had a
     * certificate for this course (a revoked one is not re-issued automatically) and meets the criteria. Runs in its
     * own transaction; concurrent duplicates are rejected by the unique constraint and ignored.
     */
    public void autoIssue(UUID courseId, UUID studentId) {
        try {
            newTx.executeWithoutResult(status -> {
                CertificateSettings s = settingsRepository.findById(courseId).orElse(null);
                if (s == null || !s.isEnabled()) {
                    return;
                }
                Course course = courses.findWithInstructor(courseId).orElse(null);
                User student = users.findById(studentId).orElse(null);
                if (course != null && student != null) {
                    issueIfEligible(course, s, student, Instant.now(clock));
                }
            });
        } catch (DataIntegrityViolationException e) {
            log.debug("Certificate for course {} / student {} was issued concurrently", courseId, studentId);
        }
    }

    private Optional<Certificate> issueIfEligible(Course course, CertificateSettings s, User student, Instant now) {
        if (!enrollments.existsByCourseIdAndStudentIdAndStatus(course.getId(), student.getId(),
                EnrollmentStatus.APPROVED)
                || !certificates.findByCourseAndStudent(course.getId(), student.getId()).isEmpty()) {
            return Optional.empty();
        }
        Evaluation evaluation = evaluator.evaluate(s, course.getId(), student.getId(), now);
        if (!evaluation.met()) {
            return Optional.empty();
        }
        return Optional.of(issue(course, s, student, IssueType.AUTOMATIC, null, evaluation.averageScore(), now));
    }

    private Certificate issue(Course course, CertificateSettings s, User student, IssueType type, User by,
                              Double finalScore, Instant now) {
        String code = CertificateCodes.generate(now);
        for (int i = 0; i < 5 && certificates.existsByCode(code); i++) {
            code = CertificateCodes.generate(now);
        }
        Certificate c = new Certificate(code, course, student, type, by, now);
        c.setLearnerName(student.getFullName());
        c.setCourseTitle(course.getTitle());
        c.setLevel(s.getLevel() != null ? s.getLevel() : course.getLevel());
        c.setInstructorName(s.getSignerName() != null ? s.getSignerName() : course.getInstructor().getFullName());
        c.setSignerTitle(s.getSignerTitle());
        c.setOrganization(s.getOrganization());
        c.setTitle(s.getTitle());
        c.setCompletedAt(now);
        c.setFinalScore(finalScore);
        certificates.saveAndFlush(c);
        String link = learnerLink(course.getId());
        notifications.notifyWithEmail(student, NotificationType.CERTIFICATE_ISSUED, "notification.certificateIssued",
                link, null, templates.certificateIssued(student, course.getTitle(), templates.link(link)),
                course.getTitle());
        return c;
    }

    @Transactional
    public InstructorCertificateDto issueManually(CurrentUser me, UUID courseId, UUID studentId) {
        Course course = courseAccess.course(courseId, me);
        User student = users.findById(studentId).orElseThrow(() -> NotFoundException.of("User"));
        if (!enrollments.existsByCourseIdAndStudentIdAndStatus(courseId, studentId, EnrollmentStatus.APPROVED)) {
            throw NotFoundException.of("Enrollment");
        }
        if (certificates.findActive(courseId, studentId).isPresent()) {
            throw new ConflictException("CERTIFICATE_EXISTS", "The learner already has a certificate for this course");
        }
        Instant now = Instant.now(clock);
        CertificateSettings s = settingsOf(courseId);
        Double score = evaluator.evaluate(s, courseId, studentId, now).averageScore();
        Certificate c = issue(course, s, student, IssueType.MANUAL, users.getReferenceById(me.id()), score, now);
        return toInstructorDto(c, issuedByName(c));
    }

    @Transactional
    public InstructorCertificateDto revoke(CurrentUser me, UUID certificateId, String reason) {
        Certificate c = manageable(me, certificateId);
        if (c.isRevoked()) {
            throw new ConflictException("CERTIFICATE_REVOKED", "The certificate has already been revoked");
        }
        c.revoke(users.getReferenceById(me.id()), reason.strip(), Instant.now(clock));
        certificates.saveAndFlush(c);
        notifications.notify(c.getStudent(), NotificationType.CERTIFICATE_REVOKED, "notification.certificateRevoked",
                learnerLink(c.getCourse().getId()), reason.strip(), c.getCourseTitle());
        return toInstructorDto(c, issuedByName(c));
    }

    @Transactional(readOnly = true)
    public List<InstructorCertificateDto> list(CurrentUser me, UUID courseId, String q) {
        courseAccess.course(courseId, me);
        String query = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
        return certificates.findByCourse(courseId).stream()
                .filter(c -> query.isEmpty() || c.getLearnerName().toLowerCase(Locale.ROOT).contains(query)
                        || c.getStudent().getEmail().toLowerCase(Locale.ROOT).contains(query)
                        || c.getStudent().getFullName().toLowerCase(Locale.ROOT).contains(query)
                        || c.getCode().toLowerCase(Locale.ROOT).contains(query))
                .map(c -> toInstructorDto(c, issuedByName(c)))
                .toList();
    }

    private Certificate manageable(CurrentUser me, UUID certificateId) {
        Certificate c = certificates.findWithContext(certificateId)
                .orElseThrow(() -> NotFoundException.of("Certificate"));
        if (!CourseAccess.canManage(c.getCourse(), me)) {
            throw NotFoundException.of("Certificate");
        }
        return c;
    }

    private static String issuedByName(Certificate c) {
        return c.getIssuedBy() == null ? null : c.getIssuedBy().getFullName();
    }

    // ------------------------------------------------------------------------------------------------------------
    // Learner
    // ------------------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CertificateDto> mine(CurrentUser me) {
        return certificates.findByStudent(me.id()).stream().map(this::toDto).toList();
    }

    /**
     * The learner's certificate status for a course. Lazily issues the certificate when the criteria are met (e.g.
     * after an essay was graded or the settings changed). Owners/admins previewing the course get the criteria only.
     */
    public CertificateStatusDto status(CurrentUser me, UUID courseId) {
        Instant now = Instant.now(clock);
        Course course = learnerAccess.course(courseId, me, now);
        try {
            return newTx.execute(s -> buildStatus(course, me.id(), now));
        } catch (DataIntegrityViolationException e) {
            // Issued concurrently by another request: read the result again.
            return newTx.execute(s -> buildStatus(course, me.id(), now));
        }
    }

    private CertificateStatusDto buildStatus(Course detached, UUID studentId, Instant now) {
        UUID courseId = detached.getId();
        List<Certificate> mine = certificates.findByCourseAndStudent(courseId, studentId);
        Optional<Certificate> active = mine.stream().filter(c -> !c.isRevoked()).findFirst();
        if (active.isPresent()) {
            return new CertificateStatusDto(StatusKind.ISSUED, true, List.of(), toDto(active.get()));
        }
        if (!mine.isEmpty()) {
            return new CertificateStatusDto(StatusKind.REVOKED, false, List.of(), toDto(mine.getFirst()));
        }
        CertificateSettings s = settingsOf(courseId);
        if (!s.isEnabled()) {
            return new CertificateStatusDto(StatusKind.NOT_ENABLED, false, List.of(), null);
        }
        Evaluation evaluation = evaluator.evaluate(s, courseId, studentId, now);
        if (evaluation.met()) {
            Course course = courses.findWithInstructor(courseId).orElseThrow(() -> NotFoundException.of("Course"));
            User student = users.findById(studentId).orElseThrow(() -> NotFoundException.of("User"));
            Optional<Certificate> issued = issueIfEligible(course, s, student, now);
            if (issued.isPresent()) {
                return new CertificateStatusDto(StatusKind.ISSUED, true, evaluation.criteria(), toDto(issued.get()));
            }
        }
        return new CertificateStatusDto(StatusKind.IN_PROGRESS, evaluation.met(), evaluation.criteria(), null);
    }

    // ------------------------------------------------------------------------------------------------------------
    // PDF
    // ------------------------------------------------------------------------------------------------------------

    public record PdfFile(String fileName, byte[] content) {
    }

    /** The learner's own, active certificate as PDF. */
    @Transactional(readOnly = true)
    public PdfFile studentPdf(CurrentUser me, UUID certificateId, String lang) {
        Certificate c = certificates.findWithContext(certificateId)
                .filter(x -> x.getStudent().getId().equals(me.id()))
                .orElseThrow(() -> NotFoundException.of("Certificate"));
        if (c.isRevoked()) {
            throw new ConflictException("CERTIFICATE_REVOKED", "The certificate has been revoked");
        }
        return pdf(c, lang);
    }

    /** Any certificate of the instructor's course (revoked ones carry a "revoked" stamp). */
    @Transactional(readOnly = true)
    public PdfFile instructorPdf(CurrentUser me, UUID certificateId, String lang) {
        return pdf(manageable(me, certificateId), lang);
    }

    private PdfFile pdf(Certificate c, String lang) {
        CertificateSettings s = settingsOf(c.getCourse().getId());
        Locale locale = locale(c, s, lang);
        String key = c.getId() + "|" + locale.getLanguage() + "|" + s.getUpdatedAt() + "|" + c.isRevoked();
        byte[] content = pdfCache.get(key);
        if (content == null) {
            byte[] signature = null;
            String signatureType = null;
            MediaAsset image = s.getSignatureImage();
            if (image != null) {
                try (InputStream in = storage.load(image.getStorageKey()).getInputStream()) {
                    signature = in.readAllBytes();
                    signatureType = image.getContentType();
                } catch (IOException e) {
                    log.warn("Signature image {} could not be read: {}", image.getId(), e.getMessage());
                }
            }
            content = renderer.render(new PdfModel(c.getCode(), c.getLearnerName(), c.getCourseTitle(), c.getLevel(),
                    c.getTitle(), c.getCompletedAt(), c.getFinalScore(), s.isShowScore(), c.getInstructorName(),
                    c.getSignerTitle(), c.getOrganization(), s.getCustomText(), signature, signatureType,
                    verificationUrl(c.getCode()), c.isRevoked(), locale));
            pdfCache.put(key, content);
        }
        return new PdfFile(fileName(c, locale), content);
    }

    private static Locale locale(Certificate c, CertificateSettings s, String lang) {
        if ("de".equalsIgnoreCase(lang) || "en".equalsIgnoreCase(lang)) {
            return I18nConfig.toLocale(lang);
        }
        return switch (s.getLanguage()) {
            case EN -> Locale.ENGLISH;
            case DE -> Locale.GERMAN;
            case LEARNER -> c.getStudent().preferredLocale();
        };
    }

    /** e.g. {@code Zertifikat-Deutsch-A1-Luca-Rossi.pdf}: the main course title (before a colon) and the name. */
    String fileName(Certificate c, Locale locale) {
        String course = c.getCourseTitle();
        int colon = course.indexOf(':');
        if (colon > 0) {
            course = course.substring(0, colon);
        }
        String name = messages.get(locale, "cert.fileName") + "-" + course + "-" + c.getLearnerName();
        String slug = name.replaceAll("[^\\p{L}\\p{N}]+", "-").replaceAll("(^-+|-+$)", "");
        if (slug.length() > 120) {
            slug = slug.substring(0, 120).replaceAll("-+$", "");
        }
        return slug + ".pdf";
    }

    // ------------------------------------------------------------------------------------------------------------
    // Public verification
    // ------------------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public VerificationDto verify(String rawCode) {
        String code = CertificateCodes.normalize(rawCode);
        Certificate c = code == null ? null : certificates.findByCode(code).orElse(null);
        if (c == null) {
            throw NotFoundException.of("Certificate");
        }
        return new VerificationDto(c.getCode(), !c.isRevoked(), c.isRevoked(), c.getLearnerName(), c.getCourseTitle(),
                c.getLevel(), c.getTitle(), c.getCompletedAt(), c.getIssuedAt(), c.getRevokedAt(),
                c.getInstructorName(), c.getOrganization());
    }

    // ------------------------------------------------------------------------------------------------------------
    // Mapping
    // ------------------------------------------------------------------------------------------------------------

    private CertificateDto toDto(Certificate c) {
        return new CertificateDto(c.getId(), c.getCode(), c.getCourse().getId(), c.getCourseTitle(),
                c.getLearnerName(), c.getLevel(), c.getTitle(), c.getCompletedAt(), c.getIssuedAt(),
                c.getFinalScore(), c.getInstructorName(), c.getOrganization(),
                c.isRevoked() ? CertificateState.REVOKED : CertificateState.ACTIVE, c.getIssueType(),
                c.getRevokedAt(), c.getRevokedReason(), verificationUrl(c.getCode()));
    }

    private InstructorCertificateDto toInstructorDto(Certificate c, String issuedByName) {
        return new InstructorCertificateDto(c.getId(), c.getCode(), userMapper.toSummary(c.getStudent()),
                c.getLearnerName(), c.getCourseTitle(), c.getLevel(), c.getCompletedAt(), c.getIssuedAt(),
                c.getFinalScore(), c.isRevoked() ? CertificateState.REVOKED : CertificateState.ACTIVE,
                c.getIssueType(), issuedByName, c.getRevokedAt(), c.getRevokedReason(), verificationUrl(c.getCode()));
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
