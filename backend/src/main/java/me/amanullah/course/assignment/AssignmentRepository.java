package me.amanullah.course.assignment;

import me.amanullah.course.common.publication.PublishStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {

    Optional<Assignment> findByItemId(UUID itemId);

    /** Assignments of items with the given status whose due date lies inside {@code [from, to]} (schedule). */
    @Query("""
            select a from Assignment a join fetch a.item i join fetch i.module m join fetch m.course c
            where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and i.publishStatus = :status
              and a.dueAt >= :from and a.dueAt <= :to
            """)
    List<Assignment> findDue(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                             @Param("status") PublishStatus status, @Param("from") Instant from,
                             @Param("to") Instant to);

    /** Assignments of the given courses with a due date, for calendar feeds. */
    @Query("""
            select a from Assignment a join fetch a.item i join fetch i.module m join fetch m.course c
            where c.id in :courseIds and a.dueAt is not null and i.publishStatus = :status
            """)
    List<Assignment> findWithDueDate(@Param("courseIds") java.util.Collection<UUID> courseIds,
                                     @Param("status") PublishStatus status);
}
