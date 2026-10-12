package me.amanullah.course.messaging;

import java.util.UUID;
import me.amanullah.course.enrollment.Enrollment;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Relationship checks behind the messaging rules (see {@link MessagingPolicy}). */
public interface MessagingEnrollmentQueries extends Repository<Enrollment, UUID> {

    /** The instructor teaches a course (or the given one) in which the learner has an enrollment of any status. */
    @Query("""
            select count(e) from Enrollment e
            where e.course.instructor.id = :instructorId and e.student.id = :learnerId
              and (:courseId is null or e.course.id = :courseId)
            """)
    long teachesLearner(@Param("instructorId") UUID instructorId, @Param("learnerId") UUID learnerId,
                           @Param("courseId") UUID courseId);

    /** The learner is APPROVED or PENDING in a course (or the given one) taught by the instructor. */
    @Query("""
            select count(e) from Enrollment e
            where e.course.instructor.id = :instructorId and e.student.id = :learnerId
              and (:courseId is null or e.course.id = :courseId)
              and e.status in (me.amanullah.course.enrollment.EnrollmentStatus.APPROVED,
                               me.amanullah.course.enrollment.EnrollmentStatus.PENDING)
            """)
    long activeLearnerOf(@Param("instructorId") UUID instructorId, @Param("learnerId") UUID learnerId,
                            @Param("courseId") UUID courseId);
}
