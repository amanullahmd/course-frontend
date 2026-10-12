package me.amanullah.course.messaging;

import java.util.UUID;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import org.springframework.stereotype.Component;

/**
 * Who may message whom:
 * <ul>
 *   <li>a learner may message the instructor of a course they are APPROVED or PENDING in;</li>
 *   <li>an instructor may message any learner with an enrollment (any status) in one of their courses;</li>
 *   <li>admins may message anyone.</li>
 * </ul>
 * With a course context the relationship must exist in that course. In an existing conversation a participant may
 * reply as long as the relationship holds in either direction (or one side is an admin).
 */
@Component
public class MessagingPolicy {

    private final MessagingEnrollmentQueries queries;

    public MessagingPolicy(MessagingEnrollmentQueries queries) {
        this.queries = queries;
    }

    public boolean canStart(User me, User other, UUID courseId) {
        if (me.getRole() == Role.ADMIN) {
            return true;
        }
        return queries.teachesLearner(me.getId(), other.getId(), courseId) > 0
                || queries.activeLearnerOf(other.getId(), me.getId(), courseId) > 0;
    }

    public boolean canReply(User me, User other, UUID courseId) {
        if (me.getRole() == Role.ADMIN || other.getRole() == Role.ADMIN) {
            return true;
        }
        return canStart(me, other, courseId) || canStart(other, me, courseId);
    }
}
