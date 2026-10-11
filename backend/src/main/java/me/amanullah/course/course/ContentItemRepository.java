package me.amanullah.course.course;

import me.amanullah.course.common.publication.PublishStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContentItemRepository extends JpaRepository<ContentItem, UUID> {

    @Query("select i from ContentItem i join fetch i.module m join fetch m.course c join fetch c.instructor where i.id = :id")
    Optional<ContentItem> findWithCourse(@Param("id") UUID id);

    List<ContentItem> findByModuleIdOrderByPositionAsc(UUID moduleId);

    long countByModuleId(UUID moduleId);

    /** All items of a course in outline order (module position, item position). */
    @Query("""
            select i from ContentItem i join fetch i.module m
            where m.course.id = :courseId order by m.position, i.position
            """)
    List<ContentItem> findOutline(@Param("courseId") UUID courseId);

    @Query("""
            select i from ContentItem i join fetch i.module m
            where m.course.id in :courseIds order by m.position, i.position
            """)
    List<ContentItem> findOutlines(@Param("courseIds") Collection<UUID> courseIds);

    @Query("""
            select i from ContentItem i join fetch i.module m join fetch m.course c
            where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and i.publishStatus = :status
              and ((i.publishAt >= :from and i.publishAt <= :to) or (i.unpublishAt >= :from and i.unpublishAt <= :to))
            """)
    List<ContentItem> findScheduled(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                                    @Param("status") PublishStatus status, @Param("from") Instant from,
                                    @Param("to") Instant to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ContentItem i where i.id = :id")
    void deleteItemById(@Param("id") UUID id);
}
