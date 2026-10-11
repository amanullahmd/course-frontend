package me.amanullah.course.assessment;

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
}
