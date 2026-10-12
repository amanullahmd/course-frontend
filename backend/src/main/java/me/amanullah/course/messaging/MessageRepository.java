package me.amanullah.course.messaging;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /** Newest first. */
    @Query("""
            select m from Message m where m.conversation.id = :conversationId
            order by m.createdAt desc, m.id desc
            """)
    List<Message> findLatest(@Param("conversationId") UUID conversationId, Pageable pageable);

    /** Newest first, strictly older than the cursor message ({@code createdAt}, then id). */
    @Query("""
            select m from Message m where m.conversation.id = :conversationId
              and (m.createdAt < :at or (m.createdAt = :at and m.id < :id))
            order by m.createdAt desc, m.id desc
            """)
    List<Message> findBefore(@Param("conversationId") UUID conversationId, @Param("at") Instant at,
                             @Param("id") UUID id, Pageable pageable);

    /** Rows of {@code [conversationId, unread]} for messages sent to {@code me} after their read marker. */
    @Query("""
            select c.id, count(m) from Message m join m.conversation c
            where c.id in :ids and m.sender.id <> :me
              and ((c.participantA.id = :me and (c.aLastReadAt is null or m.createdAt > c.aLastReadAt))
                or (c.participantB.id = :me and (c.bLastReadAt is null or m.createdAt > c.bLastReadAt)))
            group by c.id
            """)
    List<Object[]> unreadByConversation(@Param("me") UUID me, @Param("ids") Collection<UUID> ids);

    /** Rows of {@code [unreadMessages, conversationsWithUnread]}. */
    @Query("""
            select count(m), count(distinct c.id) from Message m join m.conversation c
            where m.sender.id <> :me
              and ((c.participantA.id = :me and (c.aLastReadAt is null or m.createdAt > c.aLastReadAt))
                or (c.participantB.id = :me and (c.bLastReadAt is null or m.createdAt > c.bLastReadAt)))
            """)
    List<Object[]> unreadTotals(@Param("me") UUID me);
}
