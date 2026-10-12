package me.amanullah.course.live;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LiveSessionRepository extends JpaRepository<LiveSession, UUID> {

    List<LiveSession> findByCourseIdOrderByStartsAtAsc(UUID courseId);

    @Query("""
            select s from LiveSession s join fetch s.course c join fetch c.instructor where s.id = :id
            """)
    Optional<LiveSession> findWithCourse(@Param("id") UUID id);

    /** Sessions starting inside {@code [from, to]} of the instructor's (or, with null, all) courses, not cancelled. */
    @Query("""
            select s from LiveSession s join fetch s.course c
            where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and s.cancelled = false and s.startsAt >= :from and s.startsAt <= :to
            """)
    List<LiveSession> findInWindow(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                                   @Param("from") Instant from, @Param("to") Instant to);

    /** Sessions of the given courses starting at or after {@code from} (cancelled ones included). */
    @Query("""
            select s from LiveSession s join fetch s.course c
            where c.id in :courseIds and s.startsAt >= :from order by s.startsAt asc, s.id
            """)
    List<LiveSession> findFrom(@Param("courseIds") Collection<UUID> courseIds, @Param("from") Instant from,
                               Pageable pageable);

    /** Not cancelled sessions that start in {@code (now, until]} and have not been announced yet. */
    @Query("""
            select s.id from LiveSession s
            where s.cancelled = false and s.reminderSentAt is null and s.startsAt > :now and s.startsAt <= :until
            order by s.startsAt asc, s.id
            """)
    List<UUID> findDueForReminder(@Param("now") Instant now, @Param("until") Instant until, Pageable pageable);
}
