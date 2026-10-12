package me.amanullah.course.messaging;

import java.time.Instant;
import java.util.UUID;
import me.amanullah.course.notification.Notification;
import me.amanullah.course.notification.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Message-specific queries on notifications: one unread MESSAGE notification per conversation at a time. */
public interface MessageNotificationRepository extends JpaRepository<Notification, UUID> {

    boolean existsByUserIdAndTypeAndLinkAndReadAtIsNull(UUID userId, NotificationType type, String link);

    @Modifying
    @Query("""
            update Notification n set n.readAt = :now
            where n.user.id = :userId and n.type = :type and n.link = :link and n.readAt is null
            """)
    int markRead(@Param("userId") UUID userId, @Param("type") NotificationType type, @Param("link") String link,
                 @Param("now") Instant now);
}
