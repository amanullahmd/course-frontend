package de.sprachweg.learning;

import de.sprachweg.common.exception.ForbiddenException;
import de.sprachweg.common.exception.NotFoundException;
import de.sprachweg.common.publication.Visibility;
import de.sprachweg.course.ContentItem;
import de.sprachweg.course.ContentItemRepository;
import de.sprachweg.course.Course;
import de.sprachweg.course.CourseAccess;
import de.sprachweg.course.CourseModule;
import de.sprachweg.course.CourseRepository;
import de.sprachweg.enrollment.EnrollmentRepository;
import de.sprachweg.enrollment.EnrollmentStatus;
import de.sprachweg.security.CurrentUser;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gatekeeper for learner endpoints: a learner may only see content when they have an APPROVED enrollment (or own the
 * course / are admin, for preview) AND {@code live(course) && live(module) && live(item)}. Non-live content is
 * reported as 404, a missing enrollment as 403.
 */
@Component
public class LearnerAccess {

    private final CourseRepository courses;
    private final ContentItemRepository items;
    private final EnrollmentRepository enrollments;

    public LearnerAccess(CourseRepository courses, ContentItemRepository items, EnrollmentRepository enrollments) {
        this.courses = courses;
        this.items = items;
        this.enrollments = enrollments;
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
