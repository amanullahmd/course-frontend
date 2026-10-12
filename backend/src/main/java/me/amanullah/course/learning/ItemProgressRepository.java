package me.amanullah.course.learning;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemProgressRepository extends JpaRepository<ItemProgress, UUID> {

    Optional<ItemProgress> findByStudentIdAndItemId(UUID studentId, UUID itemId);

    boolean existsByStudentIdAndItemId(UUID studentId, UUID itemId);

    /** Rows of {@code [studentId, itemId]} for the given students and items. */
    @Query("""
            select p.student.id, p.item.id from ItemProgress p
            where p.student.id in :studentIds and p.item.id in :itemIds
            """)
    List<Object[]> findCompleted(@Param("studentIds") Collection<UUID> studentIds,
                                 @Param("itemIds") Collection<UUID> itemIds);
}
