package me.amanullah.course.assessment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttemptRepository extends JpaRepository<Attempt, UUID> {

    @Query("""
            select a from Attempt a join fetch a.student
            where a.assessment.id = :assessmentId order by a.startedAt desc
            """)
    List<Attempt> findByAssessment(@Param("assessmentId") UUID assessmentId);

    @Query("""
            select a from Attempt a join fetch a.student
            where a.assessment.id = :assessmentId and a.student.id = :studentId order by a.startedAt desc
            """)
    List<Attempt> findByAssessmentAndStudent(@Param("assessmentId") UUID assessmentId,
                                             @Param("studentId") UUID studentId);

    long countByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);

    Optional<Attempt> findFirstByAssessmentIdAndStudentIdAndStatus(UUID assessmentId, UUID studentId,
                                                                   AttemptStatus status);

    @Query("""
            select a from Attempt a join fetch a.student join fetch a.assessment s join fetch s.item i
            join fetch i.module m join fetch m.course c where a.id = :id
            """)
    Optional<Attempt> findWithContext(@Param("id") UUID id);

    /** In-progress attempts whose own deadline lies before {@code cutoff} (uses the status/deadline index). */
    @Query("""
            select a.id from Attempt a
            where a.status = me.amanullah.course.assessment.AttemptStatus.IN_PROGRESS and a.deadline < :cutoff
            order by a.deadline
            """)
    List<UUID> findExpiredByDeadline(@Param("cutoff") Instant cutoff, Pageable page);

    /** In-progress attempts of assessments whose availability window closed before {@code cutoff}. */
    @Query("""
            select a.id from Attempt a join a.assessment s
            where a.status = me.amanullah.course.assessment.AttemptStatus.IN_PROGRESS and s.availableUntil < :cutoff
            order by s.availableUntil
            """)
    List<UUID> findExpiredByWindow(@Param("cutoff") Instant cutoff, Pageable page);
}
