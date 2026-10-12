package me.amanullah.course.assignment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubmissionRepository extends JpaRepository<AssignmentSubmission, UUID> {

    String LATEST = """
            s.versionNo = (select max(x.versionNo) from AssignmentSubmission x
                           where x.assignment = s.assignment and x.student = s.student)
            """;

    List<AssignmentSubmission> findByAssignmentIdAndStudentIdOrderByVersionNoAsc(UUID assignmentId, UUID studentId);

    @Query("""
            select s from AssignmentSubmission s
            where s.assignment.id = :assignmentId and s.student.id = :studentId order by s.versionNo desc
            """)
    List<AssignmentSubmission> findLatest(@Param("assignmentId") UUID assignmentId,
                                          @Param("studentId") UUID studentId,
                                          org.springframework.data.domain.Pageable pageable);

    default Optional<AssignmentSubmission> findLatest(UUID assignmentId, UUID studentId) {
        return findLatest(assignmentId, studentId, org.springframework.data.domain.PageRequest.of(0, 1))
                .stream().findFirst();
    }

    @Query("""
            select s from AssignmentSubmission s
            join fetch s.assignment a join fetch a.item i join fetch i.module m join fetch m.course c
            join fetch c.instructor join fetch s.student
            where s.id = :id
            """)
    Optional<AssignmentSubmission> findWithContext(@Param("id") UUID id);

    /** Latest version per learner for one assignment, newest first. */
    @Query("""
            select s from AssignmentSubmission s join fetch s.student
            where s.assignment.id = :assignmentId and (:status is null or s.status = :status) and
            """ + LATEST + " order by s.submittedAt desc, s.id")
    List<AssignmentSubmission> findLatestPerStudent(@Param("assignmentId") UUID assignmentId,
                                                    @Param("status") SubmissionStatus status);

    /** Latest version per learner and assignment for a whole course, newest first. */
    @Query("""
            select s from AssignmentSubmission s join fetch s.student join fetch s.assignment a join fetch a.item i
            where i.module.course.id = :courseId and (:status is null or s.status = :status) and
            """ + LATEST + " order by s.submittedAt desc, s.id")
    List<AssignmentSubmission> findLatestForCourse(@Param("courseId") UUID courseId,
                                                   @Param("status") SubmissionStatus status);

    long countByAssignmentIdAndStudentId(UUID assignmentId, UUID studentId);
}
