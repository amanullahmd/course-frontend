package me.amanullah.course.messaging;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByPairKey(String pairKey);

    @Query("""
            select c from Conversation c join fetch c.participantA join fetch c.participantB left join fetch c.course
            where c.id = :id
            """)
    Optional<Conversation> findWithParticipants(@Param("id") UUID id);

    /** The user's conversations with at least one message, most recent first; {@code q} matches name or course. */
    @Query(value = """
            select c from Conversation c join fetch c.participantA pa join fetch c.participantB pb left join fetch c.course co
            where (pa.id = :me or pb.id = :me) and c.lastMessageAt is not null
              and (:q is null
                   or (pa.id = :me and lower(pb.fullName) like :q)
                   or (pb.id = :me and lower(pa.fullName) like :q)
                   or lower(co.title) like :q)
            order by c.lastMessageAt desc, c.id
            """,
            countQuery = """
            select count(c) from Conversation c join c.participantA pa join c.participantB pb left join c.course co
            where (pa.id = :me or pb.id = :me) and c.lastMessageAt is not null
              and (:q is null
                   or (pa.id = :me and lower(pb.fullName) like :q)
                   or (pb.id = :me and lower(pa.fullName) like :q)
                   or lower(co.title) like :q)
            """)
    Page<Conversation> findForUser(@Param("me") UUID me, @Param("q") String q, Pageable pageable);

    @Query("""
            select c.id from Conversation c
            where (c.aMailPendingSince is not null and c.aMailPendingSince <= :pendingBefore
                   and (c.aLastEmailedAt is null or c.aLastEmailedAt <= :emailedBefore))
               or (c.bMailPendingSince is not null and c.bMailPendingSince <= :pendingBefore
                   and (c.bLastEmailedAt is null or c.bLastEmailedAt <= :emailedBefore))
            order by c.id
            """)
    List<UUID> findMailDue(@Param("pendingBefore") Instant pendingBefore, @Param("emailedBefore") Instant emailedBefore,
                           Pageable pageable);
}
