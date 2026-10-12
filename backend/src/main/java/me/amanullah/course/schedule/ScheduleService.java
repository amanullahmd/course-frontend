package me.amanullah.course.schedule;

import me.amanullah.course.assessment.Assessment;
import me.amanullah.course.assignment.Assignment;
import me.amanullah.course.assignment.AssignmentRepository;
import me.amanullah.course.live.LiveSession;
import me.amanullah.course.live.LiveSessionRepository;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.publication.Publishable;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.CourseModuleRepository;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.schedule.ScheduleEventDto.Action;
import me.amanullah.course.schedule.ScheduleEventDto.EntityType;
import me.amanullah.course.security.CurrentUser;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Publish/unpublish events of PUBLISHED courses, modules and items with a {@code publishAt}/{@code unpublishAt}
 * inside the requested window, plus the opening/closing of availability windows of quizzes and exams (PUBLISHED
 * items). Admins see all courses; instructors only their own.
 */
@Service
public class ScheduleService {

    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final AssessmentRepository assessments;
    private final AssignmentRepository assignments;
    private final LiveSessionRepository liveSessions;
    private final Clock clock;

    public ScheduleService(CourseRepository courses, CourseModuleRepository modules, ContentItemRepository items,
                           AssessmentRepository assessments, AssignmentRepository assignments,
                           LiveSessionRepository liveSessions, Clock clock) {
        this.courses = courses;
        this.modules = modules;
        this.items = items;
        this.assessments = assessments;
        this.assignments = assignments;
        this.liveSessions = liveSessions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ScheduleEventDto> events(CurrentUser me, Instant from, Instant to, UUID courseId) {
        Instant now = Instant.now(clock);
        Instant f = from != null ? from : now.minus(Duration.ofDays(7));
        Instant t = to != null ? to : now.plus(Duration.ofDays(60));
        if (t.isBefore(f)) {
            throw ValidationException.field("to", "validation.toBeforeFrom");
        }
        UUID instructorId = me.isAdmin() ? null : me.id();
        List<ScheduleEventDto> events = new ArrayList<>();
        for (Course c : courses.findScheduled(instructorId, courseId, PublishStatus.PUBLISHED, f, t)) {
            add(events, c, EntityType.COURSE, c.getId(), c, c.getTitle(), null, f, t);
        }
        for (CourseModule m : modules.findScheduled(instructorId, courseId, PublishStatus.PUBLISHED, f, t)) {
            add(events, m, EntityType.MODULE, m.getId(), m.getCourse(), m.getTitle(), null, f, t);
        }
        for (ContentItem i : items.findScheduled(instructorId, courseId, PublishStatus.PUBLISHED, f, t)) {
            add(events, i, EntityType.ITEM, i.getId(), i.getModule().getCourse(), i.getTitle(), i.getType(), f, t);
        }
        for (Assessment a : assessments.findWindows(instructorId, courseId, PublishStatus.PUBLISHED, f, t)) {
            ContentItem i = a.getItem();
            Course c = i.getModule().getCourse();
            if (within(a.getAvailableFrom(), f, t)) {
                events.add(event(EntityType.ITEM, i.getId(), c, i.getTitle(), i.getType(), Action.OPENS, a.getAvailableFrom()));
            }
            if (within(a.getAvailableUntil(), f, t)) {
                events.add(event(EntityType.ITEM, i.getId(), c, i.getTitle(), i.getType(), Action.CLOSES, a.getAvailableUntil()));
            }
        }
        for (Assignment a : assignments.findDue(instructorId, courseId, PublishStatus.PUBLISHED, f, t)) {
            ContentItem i = a.getItem();
            events.add(event(EntityType.ITEM, i.getId(), i.getModule().getCourse(), i.getTitle(), i.getType(),
                    Action.DUE, a.getDueAt()));
        }
        for (LiveSession s : liveSessions.findInWindow(instructorId, courseId, f, t)) {
            events.add(event(EntityType.SESSION, s.getId(), s.getCourse(), s.getTitle(), null, Action.SESSION,
                    s.getStartsAt()));
        }
        events.sort(Comparator.comparing(ScheduleEventDto::at).thenComparing(ScheduleEventDto::id));
        return events;
    }

    private static void add(List<ScheduleEventDto> out, Publishable p, EntityType type, UUID id, Course course,
                            String title, ItemType itemType, Instant from, Instant to) {
        if (within(p.getPublishAt(), from, to)) {
            out.add(event(type, id, course, title, itemType, Action.PUBLISH, p.getPublishAt()));
        }
        if (within(p.getUnpublishAt(), from, to)) {
            out.add(event(type, id, course, title, itemType, Action.UNPUBLISH, p.getUnpublishAt()));
        }
    }

    private static ScheduleEventDto event(EntityType type, UUID id, Course course, String title, ItemType itemType,
                                          Action action, Instant at) {
        return new ScheduleEventDto(type + ":" + id + ":" + action, type, id, course.getId(), course.getTitle(), title,
                itemType, action, at);
    }

    private static boolean within(Instant at, Instant from, Instant to) {
        return at != null && !at.isBefore(from) && !at.isAfter(to);
    }
}
