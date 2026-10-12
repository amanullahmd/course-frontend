package me.amanullah.course.announcement;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnouncementRecipientRepository extends JpaRepository<AnnouncementRecipient, UUID> {

    Optional<AnnouncementRecipient> findByAnnouncementIdAndUserId(UUID announcementId, UUID userId);

    /** Announcements addressed to the learner in a course (sent only): pinned first, then newest. */
    @Query("""
            select r from AnnouncementRecipient r join fetch r.announcement a join fetch a.author
            where r.user.id = :userId and a.course.id = :courseId
              and a.status = me.amanullah.course.announcement.AnnouncementStatus.SENT
            order by a.pinned desc, a.sentAt desc, a.id
            """)
    List<AnnouncementRecipient> findForLearner(@Param("userId") UUID userId, @Param("courseId") UUID courseId);

    /** Rows of {@code [announcementId, recipients, read]}. */
    @Query("""
            select r.announcement.id, count(r), count(r.readAt) from AnnouncementRecipient r
            where r.announcement.id in :ids group by r.announcement.id
            """)
    List<Object[]> stats(@Param("ids") Collection<UUID> ids);

    /** Rows of {@code [courseId, unread]} for the learner's unread announcements. */
    @Query("""
            select a.course.id, count(r) from AnnouncementRecipient r join r.announcement a
            where r.user.id = :userId and r.readAt is null
              and a.status = me.amanullah.course.announcement.AnnouncementStatus.SENT
            group by a.course.id
            """)
    List<Object[]> unreadByCourse(@Param("userId") UUID userId);
}
