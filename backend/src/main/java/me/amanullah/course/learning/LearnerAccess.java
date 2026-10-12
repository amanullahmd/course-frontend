package me.amanullah.course.learning;

import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.security.CurrentUser;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gatekeeper for learner endpoints: a learner may only see content when they have an APPROVED enrollment (or own the
 * course / are admin, for preview) AND {@code live(course) && live(module) && live(item)}. Non-live content is
 * reported as 404, a missing enrollment as 403, an item that is live but not yet released (drip, prerequisites,
 * sequence) as 403 {@code ITEM_LOCKED}; owners and admins are never locked.
 */
@Component
public class LearnerAccess {

    private final CourseRepository courses;
    private final ContentItemRepository items;
    private final EnrollmentRepository enrollments;
    private final ReleaseService release;

    public LearnerAccess(CourseRepository courses, ContentItemRepository items, EnrollmentRepository enrollments,
                         ReleaseService release) {
        this.courses = courses;
        this.items = items;
        this.enrollments = enrollments;
        this.release = release;
    }

    @Transactional(readOnly = true)
    public Course course(UUID courseId, CurrentUser me, Instant now) {
        Course course = courses.findWithInstructor(courseId)
                .filter(c -> Visibility.isLive(c, now))
                .orElseThrow(() -> NotFoundException.of("Course"));
        requireAccess(course, me);
        return course;
    }

    @Transactional(readOnly = true)
    public ContentItem item(UUID itemId, CurrentUser me, Instant now) {
        ContentItem item = items.findWithCourse(itemId).orElseThrow(() -> NotFoundException.of("Item"));
        CourseModule module = item.getModule();
        Course course = module.getCourse();
        if (!Visibility.isLive(course, now) || !Visibility.isLive(module, now) || !Visibility.isLive(item, now)) {
            throw NotFoundException.of("Item");
        }
        requireAccess(course, me);
        release.requireUnlocked(course, item.getId(), me, now);
        return item;
    }

    private void requireAccess(Course course, CurrentUser me) {
        if (CourseAccess.canManage(course, me)) {
            return;
        }
        if (!enrollments.existsByCourseIdAndStudentIdAndStatus(course.getId(), me.id(), EnrollmentStatus.APPROVED)) {
            throw new ForbiddenException("NOT_ENROLLED", "You need an approved enrollment to access this course");
        }
    }
}
