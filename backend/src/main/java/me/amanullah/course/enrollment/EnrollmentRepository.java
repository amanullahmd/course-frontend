package me.amanullah.course.enrollment;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {

    Optional<Enrollment> findByCourseIdAndStudentId(UUID courseId, UUID studentId);

    boolean existsByCourseIdAndStudentIdAndStatus(UUID courseId, UUID studentId, EnrollmentStatus status);

    long countByCourseIdAndStatus(UUID courseId, EnrollmentStatus status);

    long countByStatus(EnrollmentStatus status);

    @Query("select e from Enrollment e join fetch e.course c join fetch c.instructor join fetch e.student where e.id = :id")
    Optional<Enrollment> findWithContext(@Param("id") UUID id);

    @Query("""
            select e from Enrollment e join fetch e.student join fetch e.course
            where e.course.id = :courseId and (:status is null or e.status = :status)
            order by e.appliedAt asc, e.id asc
            """)
    List<Enrollment> findByCourse(@Param("courseId") UUID courseId, @Param("status") EnrollmentStatus status);

    @Query("""
            select e from Enrollment e join fetch e.course c join fetch c.instructor
            where e.student.id = :studentId order by e.appliedAt desc
            """)
    List<Enrollment> findByStudent(@Param("studentId") UUID studentId);

    /** Rows of {@code [courseId, count]}. */
    @Query("""
            select e.course.id, count(e) from Enrollment e
            where e.course.id in :courseIds and e.status = :status group by e.course.id
            """)
    List<Object[]> countByCourses(@Param("courseIds") Collection<UUID> courseIds,
                                  @Param("status") EnrollmentStatus status);

    /** 1-based waitlist rank by application time (ties broken by id). */
    @Query("""
            select count(e) + 1 from Enrollment e where e.course.id = :courseId and e.status = me.amanullah.course.enrollment.EnrollmentStatus.PENDING
              and (e.appliedAt < :appliedAt or (e.appliedAt = :appliedAt and e.id < :id))
            """)
    long waitlistPosition(@Param("courseId") UUID courseId, @Param("appliedAt") Instant appliedAt, @Param("id") UUID id);

    @Query("""
            select count(distinct e.student.id) from Enrollment e
            where (:instructorId is null or e.course.instructor.id = :instructorId) and e.status = :status
            """)
    long countDistinctStudents(@Param("instructorId") UUID instructorId, @Param("status") EnrollmentStatus status);

    @Query("""
            select count(e) from Enrollment e
            where (:instructorId is null or e.course.instructor.id = :instructorId) and e.status = :status
            """)
    long countForInstructor(@Param("instructorId") UUID instructorId, @Param("status") EnrollmentStatus status);

    @Query("""
            select e from Enrollment e join fetch e.course c join fetch e.student
            where (:instructorId is null or c.instructor.id = :instructorId)
              and e.status = me.amanullah.course.enrollment.EnrollmentStatus.PENDING
            order by e.appliedAt desc
            """)
    List<Enrollment> findRecentPending(@Param("instructorId") UUID instructorId, Pageable pageable);
}
