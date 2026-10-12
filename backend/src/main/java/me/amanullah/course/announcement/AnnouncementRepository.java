package me.amanullah.course.announcement;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnouncementRepository extends JpaRepository<Announcement, UUID> {

    @Query("""
            select a from Announcement a join fetch a.course c join fetch c.instructor join fetch a.author
            where a.id = :id
            """)
    Optional<Announcement> findWithContext(@Param("id") UUID id);

    /** Drafts and scheduled first, then sent ones, newest first. */
    @Query("""
            select a from Announcement a join fetch a.author where a.course.id = :courseId
            order by case when a.status = me.amanullah.course.announcement.AnnouncementStatus.SENT then 1 else 0 end,
                     coalesce(a.sentAt, a.scheduledAt, a.updatedAt) desc, a.id
            """)
    List<Announcement> findByCourse(@Param("courseId") UUID courseId);

    @Query("""
            select a.id from Announcement a
            where a.status = me.amanullah.course.announcement.AnnouncementStatus.SCHEDULED and a.scheduledAt <= :now
            order by a.scheduledAt, a.id
            """)
    List<UUID> findDue(@Param("now") Instant now, Pageable pageable);

    /** Every sent announcement of the course (preview for the owner / admin): pinned first, then newest. */
    @Query("""
            select a from Announcement a join fetch a.author
            where a.course.id = :courseId and a.status = me.amanullah.course.announcement.AnnouncementStatus.SENT
            order by a.pinned desc, a.sentAt desc, a.id
            """)
    List<Announcement> findSentByCourse(@Param("courseId") UUID courseId);
}
