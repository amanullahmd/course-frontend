package me.amanullah.course.flashcard;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FlashcardRepository extends JpaRepository<Flashcard, UUID> {

    List<Flashcard> findByItemIdOrderByPositionAsc(UUID itemId);

    long countByItemId(UUID itemId);

    /** The deck (item id) of a card, or empty for an unknown card. */
    @Query("select c.item.id from Flashcard c where c.id = :id")
    List<UUID> findItemId(@Param("id") UUID id);

    /** Cards of the given decks that the learner has never reviewed, in course order. */
    @Query("""
            select c from Flashcard c join fetch c.item i join i.module m
            where i.id in :itemIds
              and not exists (select 1 from FlashcardReview r where r.card = c and r.student.id = :studentId)
            order by m.position, i.position, c.position
            """)
    List<Flashcard> findUnseen(@Param("studentId") UUID studentId, @Param("itemIds") Collection<UUID> itemIds,
                               Pageable pageable);

    @Query("""
            select count(c) from Flashcard c
            where c.item.id in :itemIds
              and not exists (select 1 from FlashcardReview r where r.card = c and r.student.id = :studentId)
            """)
    long countUnseen(@Param("studentId") UUID studentId, @Param("itemIds") Collection<UUID> itemIds);
}
