package me.amanullah.course.flashcard;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FlashcardReviewRepository extends JpaRepository<FlashcardReview, UUID> {

    Optional<FlashcardReview> findByStudentIdAndCardId(UUID studentId, UUID cardId);

    List<FlashcardReview> findByStudentIdAndCardIdIn(UUID studentId, Collection<UUID> cardIds);

    @Query("""
            select r from FlashcardReview r join fetch r.card c join fetch c.item i
            where r.student.id = :studentId and i.id in :itemIds and r.dueAt <= :now
            order by r.dueAt asc, c.id asc
            """)
    List<FlashcardReview> findDue(@Param("studentId") UUID studentId, @Param("itemIds") Collection<UUID> itemIds,
                                  @Param("now") Instant now, Pageable pageable);

    @Query("""
            select count(r) from FlashcardReview r
            where r.student.id = :studentId and r.card.item.id in :itemIds and r.dueAt <= :now
            """)
    long countDue(@Param("studentId") UUID studentId, @Param("itemIds") Collection<UUID> itemIds,
                  @Param("now") Instant now);

    /** Cards of the decks that the learner saw for the first time since {@code since} (daily new-card limit). */
    @Query("""
            select count(r) from FlashcardReview r
            where r.student.id = :studentId and r.card.item.id in :itemIds and r.firstReviewedAt >= :since
            """)
    long countIntroducedSince(@Param("studentId") UUID studentId, @Param("itemIds") Collection<UUID> itemIds,
                              @Param("since") Instant since);
}
