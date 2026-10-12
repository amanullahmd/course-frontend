package me.amanullah.course.course;

import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.security.CurrentUser;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ownership checks for instructor endpoints. Resources of other instructors are reported as 404 so their existence
 * is not revealed; admins may manage everything.
 */
@Component
public class CourseAccess {

    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;

    public CourseAccess(CourseRepository courses, CourseModuleRepository modules, ContentItemRepository items) {
        this.courses = courses;
        this.modules = modules;
        this.items = items;
    }

    public static boolean canManage(Course course, CurrentUser me) {
        return me.isAdmin() || course.getInstructor().getId().equals(me.id());
    }

    @Transactional(readOnly = true)
    public Course course(UUID id, CurrentUser me) {
        Course c = courses.findWithInstructor(id).orElseThrow(() -> NotFoundException.of("Course"));
        if (!canManage(c, me)) {
            throw NotFoundException.of("Course");
        }
        return c;
    }

    @Transactional(readOnly = true)
    public CourseModule module(UUID id, CurrentUser me) {
        CourseModule m = modules.findWithCourse(id).orElseThrow(() -> NotFoundException.of("Module"));
        if (!canManage(m.getCourse(), me)) {
            throw NotFoundException.of("Module");
        }
        return m;
    }

    @Transactional(readOnly = true)
    public ContentItem item(UUID id, CurrentUser me) {
        ContentItem i = items.findWithCourse(id).orElseThrow(() -> NotFoundException.of("Item"));
        if (!canManage(i.getModule().getCourse(), me)) {
            throw NotFoundException.of("Item");
        }
        return i;
    }
}
