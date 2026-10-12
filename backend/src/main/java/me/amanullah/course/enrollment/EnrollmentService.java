package me.amanullah.course.enrollment;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.MessageRef;
import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseMapper;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.CourseStats;
import me.amanullah.course.course.EnrollmentMode;
import me.amanullah.course.enrollment.EnrollmentDtos.AddStudentsRequest;
import me.amanullah.course.enrollment.EnrollmentDtos.AddStudentsResult;
import me.amanullah.course.enrollment.EnrollmentDtos.BulkAction;
import me.amanullah.course.enrollment.EnrollmentDtos.SkippedEmail;
import me.amanullah.course.enrollment.EnrollmentDtos.EnrollmentDto;
import me.amanullah.course.enrollment.EnrollmentDtos.StudentEnrollmentDto;
import me.amanullah.course.learning.ProgressService;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.MailService;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnrollmentService {

    /** Maximum number of e-mail addresses per "add learners" request. */
    public static final int MAX_ADD_EMAILS = 200;

    /** Decision reason stored on enrollments created or approved by "add learners". */
    public static final String ADDED_BY_INSTRUCTOR = "Added by instructor";

    /** The same address is invited to the same course at most once within this period. */
    static final Duration REINVITE_AFTER = Duration.ofHours(24);

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@,;<>()\"]+@[^\\s@,;<>()\"]+\\.[^\\s@,;<>()\"]+$");
    private static final int MAX_EMAIL_LENGTH = 254;

    private final EnrollmentRepository enrollments;
    private final CourseInvitationRepository invitations;
    private final CourseRepository courses;
    private final UserRepository users;
    private final CourseAccess courseAccess;
    private final CourseMapper courseMapper;
    private final CourseStats stats;
    private final UserMapper userMapper;
    private final ProgressService progress;
    private final NotificationService notifications;
    private final EmailTemplates templates;
    private final MailService mail;
    private final Clock clock;

    public EnrollmentService(EnrollmentRepository enrollments, CourseInvitationRepository invitations,
                             CourseRepository courses, UserRepository users,
                             CourseAccess courseAccess, CourseMapper courseMapper, CourseStats stats,
                             UserMapper userMapper, ProgressService progress, NotificationService notifications,
                             EmailTemplates templates, MailService mail, Clock clock) {
        this.enrollments = enrollments;
        this.invitations = invitations;
        this.courses = courses;
        this.users = users;
        this.courseAccess = courseAccess;
        this.courseMapper = courseMapper;
        this.stats = stats;
        this.userMapper = userMapper;
        this.progress = progress;
        this.notifications = notifications;
        this.templates = templates;
        this.mail = mail;
        this.clock = clock;
    }

    // ---------------- student ----------------

    @Transactional
    public EnrollmentDto apply(CurrentUser me, UUID courseId, String message) {
        Instant now = Instant.now(clock);
        Course course = courses.findWithInstructor(courseId)
                .filter(c -> Visibility.isLive(c, now))
                .orElseThrow(() -> NotFoundException.of("Course"));
        if (course.getInstructor().getId().equals(me.id())) {
            throw new BadRequestException("OWN_COURSE", "You cannot enroll in your own course");
        }
        User student = users.findById(me.id()).orElseThrow(() -> NotFoundException.of("User"));
        Enrollment enrollment = enrollments.findByCourseIdAndStudentId(courseId, me.id()).orElse(null);
        if (enrollment != null && enrollment.getStatus().isActive()) {
            boolean approved = enrollment.getStatus() == EnrollmentStatus.APPROVED;
            throw new ConflictException("ALREADY_ENROLLED", approved
                    ? "You are already enrolled in this course" : "Your application is already pending")
                    .key(approved ? "error.ALREADY_ENROLLED.approved" : "error.ALREADY_ENROLLED.pending");
        }
        if (enrollment == null) {
            enrollment = new Enrollment(course, student);
        }
        String msg = message == null || message.isBlank() ? null : message.strip();
        enrollment.apply(msg, now);
        enrollments.save(enrollment);

        User instructor = course.getInstructor();
        String link = Links.instructorEnrollments(course.getId());
        if (course.getEnrollmentMode() == EnrollmentMode.OPEN && hasCapacity(course, 1)) {
            enrollment.decide(EnrollmentStatus.APPROVED, null, now);
            notifyDecision(enrollment);
            notifications.notify(instructor, NotificationType.ENROLLMENT_REQUESTED, "notification.enrollmentJoined",
                    link, null, student.getFullName(), course.getTitle());
        } else {
            notifications.notifyWithEmail(instructor, NotificationType.ENROLLMENT_REQUESTED,
                    "notification.enrollmentRequested", link, null,
                    templates.newApplication(instructor, student.getFullName(), course.getTitle(), templates.link(link)),
                    student.getFullName(), course.getTitle());
        }
        return toDto(enrollment);
    }

    @Transactional(readOnly = true)
    public EnrollmentDto mine(CurrentUser me, UUID courseId) {
        return enrollments.findByCourseIdAndStudentId(courseId, me.id()).map(this::toDto)
                .orElseThrow(() -> NotFoundException.of("Enrollment"));
    }

    @Transactional(readOnly = true)
    public List<StudentEnrollmentDto> myEnrollments(CurrentUser me) {
        List<Enrollment> list = enrollments.findByStudent(me.id());
        List<UUID> courseIds = list.stream().map(e -> e.getCourse().getId()).toList();
        Map<UUID, Long> students = stats.counts(courseIds, EnrollmentStatus.APPROVED);
        Map<UUID, Integer> percents = progress.percentForCourses(me.id(), courseIds);
        Instant now = Instant.now(clock);
        return list.stream().map(e -> {
            Course c = e.getCourse();
            return new StudentEnrollmentDto(e.getId(), e.getStatus(), e.getMessage(), e.getDecisionReason(),
                    e.getAppliedAt(), e.getDecidedAt(), waitlistPosition(e),
                    percents.getOrDefault(c.getId(), 0),
                    courseMapper.toSummary(c, students.getOrDefault(c.getId(), 0L), now));
        }).toList();
    }

    @Transactional
    public EnrollmentDto withdraw(CurrentUser me, UUID enrollmentId) {
        Enrollment e = enrollments.findWithContext(enrollmentId)
                .filter(x -> x.getStudent().getId().equals(me.id()))
                .orElseThrow(() -> NotFoundException.of("Enrollment"));
        if (!e.getStatus().isActive()) {
            throw new ConflictException("INVALID_STATUS", "Only pending or approved enrollments can be withdrawn")
                    .key("error.INVALID_STATUS.withdraw");
        }
        e.decide(EnrollmentStatus.WITHDRAWN, null, Instant.now(clock));
        Course c = e.getCourse();
        notifications.notify(c.getInstructor(), NotificationType.ENROLLMENT_WITHDRAWN, "notification.enrollmentWithdrawn",
                Links.instructorEnrollments(c.getId()), null, e.getStudent().getFullName(), c.getTitle());
        return toDto(e);
    }

    // ---------------- instructor ----------------

    @Transactional(readOnly = true)
    public List<EnrollmentDto> forCourse(CurrentUser me, UUID courseId, EnrollmentStatus status) {
        Course course = courseAccess.course(courseId, me);
        List<Enrollment> list = enrollments.findByCourse(course.getId(), status);
        Map<UUID, Integer> percents = progress.percentForStudents(course.getId(),
                list.stream().map(e -> e.getStudent().getId()).toList());
        Map<UUID, Integer> waitlist = waitlistPositions(status == EnrollmentStatus.PENDING ? list
                : enrollments.findByCourse(course.getId(), EnrollmentStatus.PENDING));
        return list.stream().map(e -> toDto(e, waitlist.get(e.getId()), percents.getOrDefault(e.getStudent().getId(), 0)))
                .toList();
    }

    @Transactional
    public EnrollmentDto approve(CurrentUser me, UUID id) {
        Enrollment e = requireManageable(me, id);
        lockCourse(e.getCourse());
        approveOne(e, Instant.now(clock));
        return toDto(e);
    }

    @Transactional
    public EnrollmentDto reject(CurrentUser me, UUID id, String reason) {
        Enrollment e = requireManageable(me, id);
        rejectOne(e, reason, Instant.now(clock));
        return toDto(e);
    }

    @Transactional
    public EnrollmentDto revoke(CurrentUser me, UUID id, String reason) {
        Enrollment e = requireManageable(me, id);
        revokeOne(e, reason, Instant.now(clock));
        return toDto(e);
    }

    /**
     * Applies an action to many enrollments atomically (all or nothing: one unknown/foreign id, wrong status or a
     * capacity overflow rolls everything back, and no notification is sent). Approvals are processed in waitlist
     * order. With {@code courseId}, every enrollment must belong to that course.
     */
    @Transactional
    public List<EnrollmentDto> bulk(CurrentUser me, List<UUID> ids, BulkAction action, String reason, UUID courseId) {
        if (courseId != null) {
            courseAccess.course(courseId, me);
        }
        List<Enrollment> list = new ArrayList<>();
        Map<String, MessageRef> otherCourse = new LinkedHashMap<>();
        Set<UUID> seen = new HashSet<>();
        for (int i = 0; i < ids.size(); i++) {
            UUID id = ids.get(i);
            if (!seen.add(id)) {
                continue;
            }
            Enrollment e = requireManageable(me, id);
            if (courseId != null && !e.getCourse().getId().equals(courseId)) {
                otherCourse.put("ids[" + i + "]", new MessageRef("validation.ids.otherCourse"));
            }
            list.add(e);
        }
        if (!otherCourse.isEmpty()) {
            throw new ValidationException(otherCourse);
        }
        list.sort(Comparator.comparing(Enrollment::getAppliedAt).thenComparing(Enrollment::getId));
        Instant now = Instant.now(clock);
        if (action == BulkAction.APPROVE) {
            list.stream().map(Enrollment::getCourse).distinct().forEach(this::lockCourse);
            requireSeatsFor(list);
        }
        for (Enrollment e : list) {
            switch (action) {
                case APPROVE -> approveOne(e, now);
                case REJECT -> rejectOne(e, reason, now);
                case REVOKE -> revokeOne(e, reason, now);
            }
        }
        return list.stream().map(this::toDto).toList();
    }

    /**
     * Adds learners by e-mail: verified, enabled accounts get an APPROVED enrollment (new, or upgraded from any
     * other status) until the capacity is reached; addresses without an account are reported (and invited when
     * {@code invite} is set). The endpoint is restricted to the course owner and admins.
     */
    @Transactional
    public AddStudentsResult addStudents(CurrentUser me, UUID courseId, AddStudentsRequest request) {
        Course course = courseAccess.course(courseId, me);
        List<String> emails = normalizeEmails(request.emails());
        lockCourse(course);
        Instant now = Instant.now(clock);
        String note = normalize(request.message());
        boolean invite = Boolean.TRUE.equals(request.invite());
        User instructor = course.getInstructor();
        String link = Links.learnCourse(course.getId());

        List<Enrollment> added = new ArrayList<>();
        List<String> alreadyEnrolled = new ArrayList<>();
        List<String> notFound = new ArrayList<>();
        List<String> invited = new ArrayList<>();
        List<SkippedEmail> skipped = new ArrayList<>();
        long seatsTaken = enrollments.countByCourseIdAndStatus(course.getId(), EnrollmentStatus.APPROVED);
        Integer capacity = course.getCapacity();

        for (String email : emails) {
            User user = users.findByEmailIgnoreCase(email).orElse(null);
            if (user == null) {
                notFound.add(email);
                continue;
            }
            if (user.getId().equals(instructor.getId())) {
                skipped.add(new SkippedEmail(email, "OWN_COURSE"));
                continue;
            }
            if (!user.isEnabled()) {
                skipped.add(new SkippedEmail(email, "ACCOUNT_DISABLED"));
                continue;
            }
            if (!user.isEmailVerified()) {
                skipped.add(new SkippedEmail(email, "EMAIL_NOT_VERIFIED"));
                continue;
            }
            Enrollment e = enrollments.findByCourseIdAndStudentId(course.getId(), user.getId()).orElse(null);
            if (e != null && e.getStatus() == EnrollmentStatus.APPROVED) {
                alreadyEnrolled.add(email);
                continue;
            }
            if (capacity != null && seatsTaken >= capacity) {
                skipped.add(new SkippedEmail(email, "CAPACITY_REACHED"));
                continue;
            }
            if (e == null) {
                e = new Enrollment(course, user);
                e.apply(null, now);
            }
            e.decide(EnrollmentStatus.APPROVED, ADDED_BY_INSTRUCTOR, now);
            enrollments.save(e);
            seatsTaken++;
            added.add(e);
            notifications.notifyWithEmail(user, NotificationType.ENROLLMENT_APPROVED, "notification.enrollmentAdded",
                    link, null, templates.enrollmentAdded(user, course.getTitle(), instructor.getFullName(), note,
                            templates.link(link)), course.getTitle(), instructor.getFullName());
        }

        if (invite && !notFound.isEmpty()) {
            Set<String> recent = new HashSet<>(invitations.findRecentlyInvited(course.getId(), notFound,
                    now.minus(REINVITE_AFTER)));
            Locale locale = instructor.preferredLocale();
            User inviter = users.getReferenceById(me.id());
            for (String email : notFound) {
                if (recent.contains(email)) {
                    skipped.add(new SkippedEmail(email, "ALREADY_INVITED"));
                    continue;
                }
                invitations.save(new CourseInvitation(course, email, inviter, now));
                mail.send(email, templates.courseInvitation(locale, course.getTitle(),
                        instructor.getFullName(), note,
                        templates.link(Links.register(email, Links.publicCourse(course.getSlug())))));
                invited.add(email);
            }
        }
        enrollments.flush();
        return new AddStudentsResult(added.stream().map(this::toDto).toList(), alreadyEnrolled, invited, notFound,
                skipped);
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> recentPending(UUID instructorId, int limit) {
        return enrollments.findRecentPending(instructorId, PageRequest.of(0, limit)).stream().map(this::toDto).toList();
    }

    // ---------------- helpers ----------------

    /** Approves PENDING and REJECTED applications and restores REVOKED and WITHDRAWN enrollments. */
    private void approveOne(Enrollment e, Instant now) {
        EnrollmentStatus previous = e.getStatus();
        if (previous == EnrollmentStatus.APPROVED) {
            return;
        }
        if (!hasCapacity(e.getCourse(), 1)) {
            throw new ConflictException("CAPACITY_REACHED", "The course has reached its capacity");
        }
        e.decide(EnrollmentStatus.APPROVED, null, now);
        enrollments.flush();
        if (previous == EnrollmentStatus.REVOKED || previous == EnrollmentStatus.WITHDRAWN) {
            Course c = e.getCourse();
            User s = e.getStudent();
            String link = Links.learnCourse(c.getId());
            notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_APPROVED, "notification.enrollmentRestored",
                    link, null, templates.enrollmentRestored(s, c.getTitle(), templates.link(link)), c.getTitle());
        } else {
            notifyDecision(e);
        }
    }

    private void revokeOne(Enrollment e, String reason, Instant now) {
        if (e.getStatus() != EnrollmentStatus.APPROVED) {
            throw new ConflictException("INVALID_STATUS", "Only approved learners can be removed from the course")
                    .key("error.INVALID_STATUS.revoke");
        }
        e.decide(EnrollmentStatus.REVOKED, normalize(reason), now);
        notifyDecision(e);
    }

    /** Bulk approvals are all or nothing: fails up front when the selection does not fit into the free seats. */
    private void requireSeatsFor(List<Enrollment> list) {
        Map<Course, Long> needed = new LinkedHashMap<>();
        for (Enrollment e : list) {
            if (e.getStatus() != EnrollmentStatus.APPROVED) {
                needed.merge(e.getCourse(), 1L, Long::sum);
            }
        }
        needed.forEach((course, count) -> {
            if (course.getCapacity() != null && !hasCapacity(course, count.intValue())) {
                long free = Math.max(0, course.getCapacity()
                        - enrollments.countByCourseIdAndStatus(course.getId(), EnrollmentStatus.APPROVED));
                throw new ConflictException("CAPACITY_REACHED", "The course has reached its capacity")
                        .key("error.CAPACITY_REACHED.bulk", count, free);
            }
        });
    }

    /** Trims, validates (per-index field errors) and de-duplicates case-insensitively; returns lower-cased. */
    private static List<String> normalizeEmails(List<String> raw) {
        Map<String, MessageRef> errors = new LinkedHashMap<>();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (int i = 0; i < raw.size(); i++) {
            String email = raw.get(i) == null ? "" : raw.get(i).strip();
            if (email.isEmpty()) {
                errors.put("emails[" + i + "]", new MessageRef("validation.required"));
            } else if (email.length() > MAX_EMAIL_LENGTH || !EMAIL.matcher(email).matches()) {
                errors.put("emails[" + i + "]", new MessageRef("validation.email"));
            } else {
                result.add(email.toLowerCase(Locale.ROOT));
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        return new ArrayList<>(result);
    }

    private void rejectOne(Enrollment e, String reason, Instant now) {
        if (e.getStatus() != EnrollmentStatus.PENDING) {
            throw new ConflictException("INVALID_STATUS", "Only pending applications can be rejected").key("error.INVALID_STATUS.reject");
        }
        e.decide(EnrollmentStatus.REJECTED, normalize(reason), now);
        notifyDecision(e);
    }

    private boolean hasCapacity(Course course, int additional) {
        if (course.getCapacity() == null) {
            return true;
        }
        long approved = enrollments.countByCourseIdAndStatus(course.getId(), EnrollmentStatus.APPROVED);
        return approved + additional <= course.getCapacity();
    }

    private void lockCourse(Course course) {
        courses.lockById(course.getId());
    }

    private void notifyDecision(Enrollment e) {
        Course c = e.getCourse();
        User s = e.getStudent();
        switch (e.getStatus()) {
            case APPROVED -> {
                String link = Links.learnCourse(c.getId());
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_APPROVED, "notification.enrollmentApproved",
                        link, null, templates.enrollmentApproved(s, c.getTitle(), templates.link(link)), c.getTitle());
            }
            case REJECTED -> {
                String link = Links.publicCourse(c.getSlug());
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_REJECTED, "notification.enrollmentRejected",
                        link, e.getDecisionReason(),
                        templates.enrollmentRejected(s, c.getTitle(), e.getDecisionReason(), templates.link("/courses")),
                        c.getTitle());
            }
            case REVOKED -> {
                String link = Links.studentDashboard();
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_REVOKED, "notification.enrollmentRevoked",
                        link, e.getDecisionReason(),
                        templates.enrollmentRevoked(s, c.getTitle(), e.getDecisionReason(), templates.link(link)),
                        c.getTitle());
            }
            default -> {
            }
        }
    }

    private Enrollment requireManageable(CurrentUser me, UUID id) {
        Enrollment e = enrollments.findWithContext(id).orElseThrow(() -> NotFoundException.of("Enrollment"));
        if (!CourseAccess.canManage(e.getCourse(), me)) {
            throw NotFoundException.of("Enrollment");
        }
        return e;
    }

    private Integer waitlistPosition(Enrollment e) {
        if (e.getStatus() != EnrollmentStatus.PENDING) {
            return null;
        }
        return (int) enrollments.waitlistPosition(e.getCourse().getId(), e.getAppliedAt(), e.getId());
    }

    private static Map<UUID, Integer> waitlistPositions(List<Enrollment> pendingOrdered) {
        Map<UUID, Integer> result = new HashMap<>();
        int pos = 1;
        for (Enrollment e : pendingOrdered) {
            if (e.getStatus() == EnrollmentStatus.PENDING) {
                result.put(e.getId(), pos++);
            }
        }
        return result;
    }

    EnrollmentDto toDto(Enrollment e) {
        int percent = progress.percentForStudents(e.getCourse().getId(), List.of(e.getStudent().getId()))
                .getOrDefault(e.getStudent().getId(), 0);
        return toDto(e, waitlistPosition(e), percent);
    }

    private EnrollmentDto toDto(Enrollment e, Integer waitlist, int percent) {
        return new EnrollmentDto(e.getId(), e.getCourse().getId(), e.getCourse().getTitle(),
                userMapper.toSummary(e.getStudent()), e.getStatus(), e.getMessage(), e.getDecisionReason(),
                e.getAppliedAt(), e.getDecidedAt(), e.getStatus() == EnrollmentStatus.PENDING ? waitlist : null, percent);
    }

    private static String normalize(String reason) {
        return reason == null || reason.isBlank() ? null : reason.strip();
    }
}
