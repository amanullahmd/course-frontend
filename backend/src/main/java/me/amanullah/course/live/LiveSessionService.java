package me.amanullah.course.live;

import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.live.LiveDtos.AttendanceEntry;
import me.amanullah.course.live.LiveDtos.AttendanceRequest;
import me.amanullah.course.live.LiveDtos.AttendanceRow;
import me.amanullah.course.live.LiveDtos.AttendanceSheetDto;
import me.amanullah.course.live.LiveDtos.LiveSessionDto;
import me.amanullah.course.live.LiveDtos.LiveSessionUpsert;
import me.amanullah.course.live.LiveDtos.SeriesRequest;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Live sessions of a course (instructor side): CRUD, weekly series, cancellation and attendance. */
@Service
public class LiveSessionService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Berlin");

    private final LiveSessionRepository sessions;
    private final LiveAttendanceRepository attendance;
    private final EnrollmentRepository enrollments;
    private final CourseAccess access;
    private final NotificationService notifications;
    private final UserMapper userMapper;
    private final Clock clock;

    public LiveSessionService(LiveSessionRepository sessions, LiveAttendanceRepository attendance,
                              EnrollmentRepository enrollments, CourseAccess access,
                              NotificationService notifications, UserMapper userMapper, Clock clock) {
        this.sessions = sessions;
        this.attendance = attendance;
        this.enrollments = enrollments;
        this.access = access;
        this.notifications = notifications;
        this.userMapper = userMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LiveSessionDto> list(CurrentUser me, UUID courseId) {
        Course course = access.course(courseId, me);
        List<LiveSession> list = sessions.findByCourseIdOrderByStartsAtAsc(course.getId());
        Map<UUID, List<LiveAttendance>> bySession = new HashMap<>();
        if (!list.isEmpty()) {
            attendance.findBySessionIdIn(list.stream().map(LiveSession::getId).toList())
                    .forEach(a -> bySession.computeIfAbsent(a.getSessionId(), k -> new ArrayList<>()).add(a));
        }
        return list.stream().map(s -> toDto(s, bySession.getOrDefault(s.getId(), List.of()))).toList();
    }

    @Transactional
    public LiveSessionDto create(CurrentUser me, UUID courseId, LiveSessionUpsert req) {
        Course course = access.course(courseId, me);
        LiveSession s = new LiveSession(course);
        apply(s, req);
        sessions.save(s);
        return toDto(s, List.of());
    }

    @Transactional
    public List<LiveSessionDto> createSeries(CurrentUser me, UUID courseId, SeriesRequest req) {
        Course course = access.course(courseId, me);
        String joinUrl = url("joinUrl", req.joinUrl());
        UUID seriesId = UUID.randomUUID();
        ZonedDateTime first = req.firstStartsAt().atZone(ZONE);
        List<LiveSession> created = new ArrayList<>();
        for (int i = 0; i < req.weeks(); i++) {
            LiveSession s = new LiveSession(course);
            s.setSeriesId(seriesId);
            s.setTitle(req.title().strip());
            s.setDescription(blankToNull(req.description()));
            s.setStartsAt(first.plusWeeks(i).toInstant());
            s.setDurationMinutes(req.durationMinutes());
            s.setJoinUrl(joinUrl);
            created.add(s);
        }
        sessions.saveAll(created);
        return created.stream().map(s -> toDto(s, List.of())).toList();
    }

    @Transactional
    public LiveSessionDto update(CurrentUser me, UUID id, LiveSessionUpsert req) {
        LiveSession s = requireManageable(me, id);
        boolean wasCancelled = s.isCancelled();
        apply(s, req);
        sessions.flush();
        if (!wasCancelled && s.isCancelled() && s.getStartsAt().isAfter(Instant.now(clock))) {
            notifyCancelled(s);
        }
        return toDto(s, attendance.findBySessionId(s.getId()));
    }

    @Transactional
    public void delete(CurrentUser me, UUID id) {
        LiveSession s = requireManageable(me, id);
        if (!s.isCancelled() && s.getStartsAt().isAfter(Instant.now(clock))) {
            notifyCancelled(s);
        }
        sessions.delete(s);
    }

    @Transactional(readOnly = true)
    public AttendanceSheetDto sheet(CurrentUser me, UUID id) {
        LiveSession s = requireManageable(me, id);
        Map<UUID, AttendanceStatus> recorded = new HashMap<>();
        attendance.findBySessionId(s.getId()).forEach(a -> recorded.put(a.getStudentId(), a.getStatus()));
        List<AttendanceRow> rows = enrollments.findByCourse(s.getCourse().getId(), EnrollmentStatus.APPROVED).stream()
                .map(Enrollment::getStudent)
                .map(u -> new AttendanceRow(userMapper.toSummary(u), recorded.get(u.getId()))).toList();
        return new AttendanceSheetDto(s.getId(), rows);
    }

    @Transactional
    public AttendanceSheetDto saveAttendance(CurrentUser me, UUID id, AttendanceRequest req) {
        LiveSession s = requireManageable(me, id);
        Set<UUID> approved = new HashSet<>();
        enrollments.findByCourse(s.getCourse().getId(), EnrollmentStatus.APPROVED)
                .forEach(e -> approved.add(e.getStudent().getId()));
        Set<UUID> seen = new HashSet<>();
        List<AttendanceEntry> entries = req.entries();
        for (int i = 0; i < entries.size(); i++) {
            UUID student = entries.get(i).studentId();
            if (!approved.contains(student)) {
                throw ValidationException.field("entries[" + i + "].studentId", "validation.recipients");
            }
            if (!seen.add(student)) {
                throw ValidationException.field("entries[" + i + "].studentId", "validation.ids.duplicates");
            }
        }
        Map<UUID, LiveAttendance> existing = new HashMap<>();
        attendance.findBySessionId(s.getId()).forEach(a -> existing.put(a.getStudentId(), a));
        for (AttendanceEntry e : entries) {
            LiveAttendance a = existing.get(e.studentId());
            if (a == null) {
                attendance.save(new LiveAttendance(s.getId(), e.studentId(), e.status()));
            } else {
                a.setStatus(e.status());
            }
        }
        attendance.flush();
        return sheet(me, id);
    }

    // ---------------- helpers ----------------

    private void apply(LiveSession s, LiveSessionUpsert req) {
        s.setTitle(req.title().strip());
        s.setDescription(blankToNull(req.description()));
        if (s.getStartsAt() != null && !s.getStartsAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS)
                .equals(req.startsAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS))) {
            s.setReminderSentAt(null); // a moved session is announced again
        }
        s.setStartsAt(req.startsAt());
        s.setDurationMinutes(req.durationMinutes());
        s.setJoinUrl(url("joinUrl", req.joinUrl()));
        s.setRecordingUrl(url("recordingUrl", req.recordingUrl()));
        s.setCancelled(Boolean.TRUE.equals(req.cancelled()));
    }

    private void notifyCancelled(LiveSession s) {
        Course course = s.getCourse();
        String link = Links.learnLive(course.getId());
        for (Enrollment e : enrollments.findByCourse(course.getId(), EnrollmentStatus.APPROVED)) {
            User u = e.getStudent();
            if (u.isEnabled()) {
                notifications.notify(u, NotificationType.LIVE_SESSION_CANCELLED, "notification.liveCancelled", link,
                        null, s.getTitle(), formatStart(s.getStartsAt(), u.preferredLocale()), course.getTitle());
            }
        }
    }

    static String formatStart(Instant at, Locale locale) {
        return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT).withLocale(locale)
                .withZone(ZONE).format(at);
    }

    private LiveSession requireManageable(CurrentUser me, UUID id) {
        LiveSession s = sessions.findWithCourse(id).orElseThrow(() -> NotFoundException.of("Live session"));
        if (!CourseAccess.canManage(s.getCourse(), me)) {
            throw NotFoundException.of("Live session");
        }
        return s;
    }

    private static String url(String field, String value) {
        String v = blankToNull(value);
        if (v != null && !UrlChecks.isHttpUrl(v)) {
            throw ValidationException.field(field, "validation.httpUrl");
        }
        return v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static LiveSessionDto toDto(LiveSession s, List<LiveAttendance> records) {
        int present = (int) records.stream().filter(a -> a.getStatus() == AttendanceStatus.PRESENT
                || a.getStatus() == AttendanceStatus.LATE).count();
        return new LiveSessionDto(s.getId(), s.getCourse().getId(), s.getSeriesId(), s.getTitle(), s.getDescription(),
                s.getStartsAt(), s.endsAt(), s.getDurationMinutes(), s.getJoinUrl(), s.getRecordingUrl(),
                s.isCancelled(), records.size(), present, s.getCreatedAt());
    }
}
