package me.amanullah.course.live;

import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assignment.AssignmentRepository;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.common.util.Tokens;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.live.IcsWriter.Event;
import me.amanullah.course.live.LiveDtos.CalendarTokenDto;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The tokenized per-user iCal feed: live sessions, assignment due dates and exam windows of the user's approved
 * courses (and, for instructors, their own courses). Join URLs are never part of the feed, only a link to the course.
 */
@Service
public class CalendarService {

    static final int MAX_SESSIONS = 1000;

    private final UserRepository users;
    private final EnrollmentRepository enrollments;
    private final CourseRepository courses;
    private final LiveSessionRepository sessions;
    private final AssignmentRepository assignments;
    private final AssessmentRepository assessments;
    private final Messages messages;
    private final AppProperties props;
    private final Clock clock;

    public CalendarService(UserRepository users, EnrollmentRepository enrollments, CourseRepository courses,
                           LiveSessionRepository sessions, AssignmentRepository assignments,
                           AssessmentRepository assessments, Messages messages, AppProperties props, Clock clock) {
        this.users = users;
        this.enrollments = enrollments;
        this.courses = courses;
        this.sessions = sessions;
        this.assignments = assignments;
        this.assessments = assessments;
        this.messages = messages;
        this.props = props;
        this.clock = clock;
    }

    /** The current feed token; created on first use. */
    @Transactional
    public CalendarTokenDto token(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> NotFoundException.of("User"));
        if (u.getCalendarToken() == null) {
            u.setCalendarToken(Tokens.random());
        }
        return dto(u.getCalendarToken());
    }

    /** Replaces the token; the old feed URL stops working immediately. */
    @Transactional
    public CalendarTokenDto rotate(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> NotFoundException.of("User"));
        u.setCalendarToken(Tokens.random());
        return dto(u.getCalendarToken());
    }

    private CalendarTokenDto dto(String token) {
        return new CalendarTokenDto(token, props.publicBaseUrl().replaceAll("/+$", "") + "/api/calendar/" + token + ".ics");
    }

    /** The iCalendar document for the token, empty for an unknown token or a disabled/deleted account. */
    @Transactional(readOnly = true)
    public Optional<String> feed(String token) {
        if (token == null || token.length() < 20 || token.length() > 64) {
            return Optional.empty();
        }
        User user = users.findByCalendarToken(token).filter(u -> u.isEnabled() && !u.isDeleted()).orElse(null);
        if (user == null) {
            return Optional.empty();
        }
        Instant now = Instant.now(clock);
        Locale locale = user.preferredLocale();

        // course id -> owned by the user (instructors see their own courses regardless of the publication state)
        Map<UUID, Boolean> scope = new LinkedHashMap<>();
        Map<UUID, Course> byId = new LinkedHashMap<>();
        for (Enrollment e : enrollments.findByStudent(user.getId())) {
            if (e.getStatus() == EnrollmentStatus.APPROVED && Visibility.isLive(e.getCourse(), now)) {
                scope.put(e.getCourse().getId(), false);
                byId.put(e.getCourse().getId(), e.getCourse());
            }
        }
        if (user.getRole() != Role.STUDENT) {
            for (Course c : courses.findByInstructorId(user.getId())) {
                scope.put(c.getId(), true);
                byId.put(c.getId(), c);
            }
        }
        List<Event> events = new ArrayList<>();
        if (!scope.isEmpty()) {
            Instant from = now.minus(Duration.ofDays(30));
            for (LiveSession s : sessions.findFrom(scope.keySet(), from, PageRequest.of(0, MAX_SESSIONS))) {
                events.add(new Event("session-" + s.getId() + "@sprachweg", s.getStartsAt(), s.endsAt(),
                        "[" + s.getCourse().getTitle() + "] " + s.getTitle(), s.getDescription(),
                        courseLink(s.getCourse().getId()), s.isCancelled(),
                        s.getUpdatedAt() == null ? now : s.getUpdatedAt()));
            }
            for (var a : assignments.findWithDueDate(scope.keySet(), PublishStatus.PUBLISHED)) {
                ContentItem item = a.getItem();
                Course course = item.getModule().getCourse();
                if (!scope.get(course.getId()) && !(Visibility.isLive(item.getModule(), now)
                        && Visibility.isLive(item, now))) {
                    continue;
                }
                events.add(new Event("assignment-" + a.getId() + "@sprachweg", a.getDueAt(),
                        a.getDueAt().plus(Duration.ofMinutes(15)),
                        messages.get(locale, "calendar.due", item.getTitle()) + " [" + course.getTitle() + "]", null,
                        courseLink(course.getId()), false, now));
            }
            for (UUID courseId : scope.keySet()) {
                for (var a : assessments.findWindows(null, courseId, PublishStatus.PUBLISHED, from,
                        now.plus(Duration.ofDays(400)))) {
                    ContentItem item = a.getItem();
                    if (item.getType() != ItemType.EXAM || a.getAvailableFrom() == null
                            || a.getAvailableUntil() == null || !a.getAvailableUntil().isAfter(a.getAvailableFrom())) {
                        continue;
                    }
                    Course course = byId.get(courseId);
                    if (!scope.get(courseId) && !(Visibility.isLive(item.getModule(), now)
                            && Visibility.isLive(item, now))) {
                        continue;
                    }
                    events.add(new Event("exam-" + item.getId() + "@sprachweg", a.getAvailableFrom(),
                            a.getAvailableUntil(),
                            messages.get(locale, "calendar.exam", item.getTitle()) + " [" + course.getTitle() + "]",
                            null, courseLink(courseId), false, now));
                }
            }
        }
        events.sort(java.util.Comparator.comparing(Event::start).thenComparing(Event::uid));
        return Optional.of(IcsWriter.calendar("Sprachweg", events));
    }

    private String courseLink(UUID courseId) {
        return props.frontendUrl().replaceAll("/+$", "") + "/learn/" + courseId;
    }
}
