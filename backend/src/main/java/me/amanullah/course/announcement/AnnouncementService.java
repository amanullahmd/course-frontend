package me.amanullah.course.announcement;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import me.amanullah.course.announcement.AnnouncementDtos.AnnouncementDto;
import me.amanullah.course.announcement.AnnouncementDtos.AnnouncementUpsert;
import me.amanullah.course.announcement.AnnouncementDtos.AuthorDto;
import me.amanullah.course.announcement.AnnouncementDtos.CourseUnreadDto;
import me.amanullah.course.announcement.AnnouncementDtos.LearnerAnnouncementDto;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.common.util.TextLimits;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnnouncementService {

    /** Changes later than this after sending mark an announcement as "edited" for learners. */
    private static final Duration EDIT_GRACE = Duration.ofMinutes(1);

    private final AnnouncementRepository announcements;
    private final AnnouncementRecipientRepository recipients;
    private final AnnouncementSender sender;
    private final EnrollmentRepository enrollments;
    private final UserRepository users;
    private final CourseAccess courseAccess;
    private final LearnerAccess learnerAccess;
    private final UserMapper userMapper;
    private final Clock clock;

    public AnnouncementService(AnnouncementRepository announcements, AnnouncementRecipientRepository recipients,
                               AnnouncementSender sender, EnrollmentRepository enrollments, UserRepository users,
                               CourseAccess courseAccess, LearnerAccess learnerAccess, UserMapper userMapper,
                               Clock clock) {
        this.announcements = announcements;
        this.recipients = recipients;
        this.sender = sender;
        this.enrollments = enrollments;
        this.users = users;
        this.courseAccess = courseAccess;
        this.learnerAccess = learnerAccess;
        this.userMapper = userMapper;
        this.clock = clock;
    }

    // ---------------- instructor ----------------

    @Transactional(readOnly = true)
    public List<AnnouncementDto> list(CurrentUser me, UUID courseId) {
        Course course = courseAccess.course(courseId, me);
        List<Announcement> list = announcements.findByCourse(course.getId());
        return toDtos(course, list);
    }

    @Transactional(readOnly = true)
    public AnnouncementDto get(CurrentUser me, UUID id) {
        Announcement a = load(id, me);
        return toDtos(a.getCourse(), List.of(a)).getFirst();
    }

    @Transactional
    public AnnouncementDto create(CurrentUser me, UUID courseId, AnnouncementUpsert req) {
        Course course = courseAccess.course(courseId, me);
        User author = users.findById(me.id()).orElseThrow(() -> NotFoundException.of("User"));
        Announcement a = new Announcement(course, author);
        apply(a, req, Instant.now(clock));
        announcements.save(a);
        return toDtos(course, List.of(a)).getFirst();
    }

    @Transactional
    public AnnouncementDto update(CurrentUser me, UUID id, AnnouncementUpsert req) {
        Announcement a = load(id, me);
        apply(a, req, Instant.now(clock));
        a.touch();
        announcements.flush();
        return toDtos(a.getCourse(), List.of(a)).getFirst();
    }

    @Transactional
    public void delete(CurrentUser me, UUID id) {
        announcements.delete(load(id, me));
    }

    @Transactional
    public AnnouncementDto send(CurrentUser me, UUID id) {
        Announcement a = load(id, me);
        if (a.getStatus() == AnnouncementStatus.SENT) {
            throw new ConflictException("INVALID_STATUS", "This announcement has already been sent")
                    .key("error.INVALID_STATUS.announcementSent");
        }
        sender.deliver(a, Instant.now(clock), true);
        announcements.flush();
        return toDtos(a.getCourse(), List.of(a)).getFirst();
    }

    private Announcement load(UUID id, CurrentUser me) {
        Announcement a = announcements.findWithContext(id).orElseThrow(() -> NotFoundException.of("Announcement"));
        if (!CourseAccess.canManage(a.getCourse(), me)) {
            throw NotFoundException.of("Announcement");
        }
        return a;
    }

    private void apply(Announcement a, AnnouncementUpsert req, Instant now) {
        String body = TextLimits.requireMax("body", HtmlSanitizer.sanitize(req.body()), AnnouncementDtos.MAX_BODY);
        if (HtmlSanitizer.toPlainText(body).isBlank() && !body.contains("<img")) {
            throw ValidationException.field("body", "validation.required");
        }
        a.setTitle(req.title().strip());
        a.setBody(body);
        a.setPinned(Boolean.TRUE.equals(req.pinned()));
        if (a.getStatus() == AnnouncementStatus.SENT) {
            return; // content only: audience, e-mail and schedule are history now
        }
        AnnouncementStatus status = req.status() == null ? AnnouncementStatus.DRAFT : req.status();
        if (status == AnnouncementStatus.SENT) {
            throw ValidationException.field("status", "validation.invalidValue");
        }
        if (status == AnnouncementStatus.SCHEDULED) {
            if (req.scheduledAt() == null) {
                throw ValidationException.field("scheduledAt", "validation.required");
            }
            if (!req.scheduledAt().isAfter(now)) {
                throw ValidationException.field("scheduledAt", "validation.futureDate");
            }
        }
        Set<UUID> selected = new LinkedHashSet<>();
        if (req.audience() == AnnouncementAudience.SELECTED) {
            if (req.recipientIds() == null || req.recipientIds().isEmpty()) {
                throw ValidationException.field("recipientIds", "validation.required");
            }
            selected.addAll(req.recipientIds());
            Set<UUID> approved = approvedLearnerIds(a.getCourse().getId());
            if (!approved.containsAll(selected)) {
                throw ValidationException.field("recipientIds", "validation.recipients");
            }
        }
        a.setAudience(req.audience());
        a.setSelectedUserIds(selected);
        a.setSendEmail(Boolean.TRUE.equals(req.sendEmail()));
        a.setStatus(status);
        a.setScheduledAt(status == AnnouncementStatus.SCHEDULED ? req.scheduledAt() : null);
    }

    private Set<UUID> approvedLearnerIds(UUID courseId) {
        return enrollments.findByCourse(courseId, EnrollmentStatus.APPROVED).stream()
                .map(Enrollment::getStudent).filter(User::isEnabled).map(User::getId)
                .collect(Collectors.toSet());
    }

    private List<AnnouncementDto> toDtos(Course course, List<Announcement> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        Map<UUID, long[]> stats = new HashMap<>();
        List<UUID> sentIds = list.stream().filter(a -> a.getStatus() == AnnouncementStatus.SENT)
                .map(Announcement::getId).toList();
        if (!sentIds.isEmpty()) {
            for (Object[] row : recipients.stats(sentIds)) {
                stats.put((UUID) row[0], new long[] {((Number) row[1]).longValue(), ((Number) row[2]).longValue()});
            }
        }
        Set<UUID> approved = list.stream().anyMatch(a -> a.getStatus() != AnnouncementStatus.SENT)
                ? approvedLearnerIds(course.getId()) : Set.of();
        List<AnnouncementDto> result = new ArrayList<>(list.size());
        for (Announcement a : list) {
            long count;
            long read = 0;
            if (a.getStatus() == AnnouncementStatus.SENT) {
                long[] s = stats.getOrDefault(a.getId(), new long[] {0, 0});
                count = s[0];
                read = s[1];
            } else if (a.getAudience() == AnnouncementAudience.ALL_APPROVED) {
                count = approved.size();
            } else {
                count = a.getSelectedUserIds().stream().filter(approved::contains).count();
            }
            int percent = count == 0 ? 0 : (int) Math.round(read * 100.0 / count);
            result.add(new AnnouncementDto(a.getId(), course.getId(), course.getTitle(), author(a.getAuthor()),
                    a.getTitle(), a.getBody(), a.getAudience(), List.copyOf(a.getSelectedUserIds()), a.isSendEmail(),
                    a.isPinned(), a.getStatus(), a.getScheduledAt(), a.getSentAt(), a.getCreatedAt(), a.getUpdatedAt(),
                    count, read, percent));
        }
        return result;
    }

    private AuthorDto author(User u) {
        return new AuthorDto(u.getId(), u.getFullName(), userMapper.avatarUrl(u));
    }

    // ---------------- learner ----------------

    /**
     * Sent announcements addressed to the learner (APPROVED enrollment required), pinned first, then newest. The
     * course owner / an admin previewing the course sees every sent announcement (marked as read).
     */
    @Transactional(readOnly = true)
    public List<LearnerAnnouncementDto> forLearner(CurrentUser me, UUID courseId) {
        Course course = learnerAccess.course(courseId, me, Instant.now(clock));
        if (CourseAccess.canManage(course, me)) {
            return announcements.findSentByCourse(courseId).stream().map(a -> toLearnerDto(a, true)).toList();
        }
        return recipients.findForLearner(me.id(), courseId).stream()
                .map(r -> toLearnerDto(r.getAnnouncement(), r.getReadAt() != null)).toList();
    }

    @Transactional
    public void markRead(CurrentUser me, UUID id) {
        AnnouncementRecipient r = recipients.findByAnnouncementIdAndUserId(id, me.id())
                .orElseThrow(() -> NotFoundException.of("Announcement"));
        if (r.getReadAt() == null) {
            r.setReadAt(Instant.now(clock));
        }
    }

    @Transactional(readOnly = true)
    public List<CourseUnreadDto> unreadByCourse(CurrentUser me) {
        return recipients.unreadByCourse(me.id()).stream()
                .map(row -> new CourseUnreadDto((UUID) row[0], ((Number) row[1]).longValue())).toList();
    }

    private LearnerAnnouncementDto toLearnerDto(Announcement a, boolean read) {
        boolean edited = a.getSentAt() != null && a.getUpdatedAt() != null
                && a.getUpdatedAt().isAfter(a.getSentAt().plus(EDIT_GRACE));
        return new LearnerAnnouncementDto(a.getId(), a.getCourse().getId(), author(a.getAuthor()), a.getTitle(),
                a.getBody(), a.isPinned(), a.getSentAt(), a.getUpdatedAt(), edited, read);
    }
}
