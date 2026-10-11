package me.amanullah.course.enrollment;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseMapper;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.CourseStats;
import me.amanullah.course.course.EnrollmentMode;
import me.amanullah.course.enrollment.EnrollmentDtos.BulkAction;
import me.amanullah.course.enrollment.EnrollmentDtos.EnrollmentDto;
import me.amanullah.course.enrollment.EnrollmentDtos.StudentEnrollmentDto;
import me.amanullah.course.learning.ProgressService;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollments;
    private final CourseRepository courses;
    private final UserRepository users;
    private final CourseAccess courseAccess;
    private final CourseMapper courseMapper;
    private final CourseStats stats;
    private final UserMapper userMapper;
    private final ProgressService progress;
    private final NotificationService notifications;
    private final EmailTemplates templates;
    private final Clock clock;

    public EnrollmentService(EnrollmentRepository enrollments, CourseRepository courses, UserRepository users,
                             CourseAccess courseAccess, CourseMapper courseMapper, CourseStats stats,
                             UserMapper userMapper, ProgressService progress, NotificationService notifications,
                             EmailTemplates templates, Clock clock) {
        this.enrollments = enrollments;
        this.courses = courses;
        this.users = users;
        this.courseAccess = courseAccess;
        this.courseMapper = courseMapper;
        this.stats = stats;
        this.userMapper = userMapper;
        this.progress = progress;
        this.notifications = notifications;
        this.templates = templates;
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
            throw new ConflictException("ALREADY_ENROLLED", enrollment.getStatus() == EnrollmentStatus.APPROVED
                    ? "You are already enrolled in this course" : "Your application is already pending");
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
            notifications.notify(instructor, NotificationType.ENROLLMENT_REQUESTED, "Neue Einschreibung",
                    student.getFullName() + " hat sich in „" + course.getTitle() + "“ eingeschrieben.", link);
        } else {
            notifications.notifyWithEmail(instructor, NotificationType.ENROLLMENT_REQUESTED, "Neue Bewerbung",
                    student.getFullName() + " möchte am Kurs „" + course.getTitle() + "“ teilnehmen.", link,
                    templates.newApplication(instructor.getFullName(), student.getFullName(), course.getTitle(),
                            templates.link(link)));
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
            throw new ConflictException("INVALID_STATUS", "Only pending or approved enrollments can be withdrawn");
        }
        e.decide(EnrollmentStatus.WITHDRAWN, null, Instant.now(clock));
        Course c = e.getCourse();
        notifications.notify(c.getInstructor(), NotificationType.ENROLLMENT_WITHDRAWN, "Bewerbung zurückgezogen",
                e.getStudent().getFullName() + " hat sich von „" + c.getTitle() + "“ abgemeldet.",
                Links.instructorEnrollments(c.getId()));
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
        if (e.getStatus() != EnrollmentStatus.APPROVED) {
            throw new ConflictException("INVALID_STATUS", "Only approved enrollments can be revoked");
        }
        e.decide(EnrollmentStatus.REVOKED, normalize(reason), Instant.now(clock));
        notifyDecision(e);
        return toDto(e);
    }

    /** Applies an action to many enrollments atomically. Approvals are processed in waitlist order. */
    @Transactional
    public List<EnrollmentDto> bulk(CurrentUser me, List<UUID> ids, BulkAction action, String reason) {
        List<Enrollment> list = new ArrayList<>();
        for (UUID id : new LinkedHashSet<>(ids)) {
            list.add(requireManageable(me, id));
        }
        list.sort(Comparator.comparing(Enrollment::getAppliedAt).thenComparing(Enrollment::getId));
        Instant now = Instant.now(clock);
        if (action == BulkAction.APPROVE) {
            list.stream().map(Enrollment::getCourse).distinct().forEach(this::lockCourse);
        }
        for (Enrollment e : list) {
            if (action == BulkAction.APPROVE) {
                approveOne(e, now);
            } else {
                rejectOne(e, reason, now);
            }
        }
        return list.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> recentPending(UUID instructorId, int limit) {
        return enrollments.findRecentPending(instructorId, PageRequest.of(0, limit)).stream().map(this::toDto).toList();
    }

    // ---------------- helpers ----------------

    private void approveOne(Enrollment e, Instant now) {
        if (e.getStatus() == EnrollmentStatus.APPROVED) {
            return;
        }
        if (e.getStatus() != EnrollmentStatus.PENDING && e.getStatus() != EnrollmentStatus.REJECTED) {
            throw new ConflictException("INVALID_STATUS", "Only pending or rejected applications can be approved");
        }
        if (!hasCapacity(e.getCourse(), 1)) {
            throw new ConflictException("CAPACITY_REACHED", "The course has reached its capacity");
        }
        e.decide(EnrollmentStatus.APPROVED, null, now);
        enrollments.flush();
        notifyDecision(e);
    }

    private void rejectOne(Enrollment e, String reason, Instant now) {
        if (e.getStatus() != EnrollmentStatus.PENDING) {
            throw new ConflictException("INVALID_STATUS", "Only pending applications can be rejected");
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
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_APPROVED, "Bewerbung angenommen",
                        "Du hast jetzt Zugang zu „" + c.getTitle() + "“.", link,
                        templates.enrollmentApproved(s.getFullName(), c.getTitle(), templates.link(link)));
            }
            case REJECTED -> {
                String link = Links.publicCourse(c.getSlug());
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_REJECTED, "Bewerbung abgelehnt",
                        "Deine Bewerbung für „" + c.getTitle() + "“ wurde abgelehnt."
                                + (e.getDecisionReason() == null ? "" : " Begründung: " + e.getDecisionReason()), link,
                        templates.enrollmentRejected(s.getFullName(), c.getTitle(), e.getDecisionReason(),
                                templates.link("/courses")));
            }
            case REVOKED -> {
                String link = Links.studentDashboard();
                notifications.notifyWithEmail(s, NotificationType.ENROLLMENT_REVOKED, "Zugang beendet",
                        "Dein Zugang zu „" + c.getTitle() + "“ wurde beendet."
                                + (e.getDecisionReason() == null ? "" : " Begründung: " + e.getDecisionReason()), link,
                        templates.enrollmentRevoked(s.getFullName(), c.getTitle(), e.getDecisionReason(),
                                templates.link(link)));
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
