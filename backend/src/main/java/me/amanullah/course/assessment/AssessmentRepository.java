package me.amanullah.course.assessment;

import me.amanullah.course.common.publication.PublishStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {

    Optional<Assessment> findByItemId(UUID itemId);

    boolean existsByItemId(UUID itemId);

    /** Rows of {@code [itemId, questionCount, totalPoints, timeLimitMinutes]}. */
    @Query("""
            select a.item.id, count(q.id), coalesce(sum(q.points), 0), a.timeLimitMinutes
            from Assessment a left join a.questions q
            where a.item.id in :itemIds
            group by a.item.id, a.timeLimitMinutes
            """)
    List<Object[]> summarize(@Param("itemIds") Collection<UUID> itemIds);

    /** Assessments of items with the given status whose window opens or closes inside {@code [from, to]}. */
    @Query("""
            select a from Assessment a join fetch a.item i join fetch i.module m join fetch m.course c
            where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and i.publishStatus = :status
              and ((a.availableFrom >= :from and a.availableFrom <= :to)
                or (a.availableUntil >= :from and a.availableUntil <= :to))
            """)
    List<Assessment> findWindows(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                                 @Param("status") PublishStatus status, @Param("from") Instant from,
                                 @Param("to") Instant to);
}
