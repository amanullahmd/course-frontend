package me.amanullah.course.course;

import me.amanullah.course.common.publication.PublishStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    String LIVE = """
            c.publishStatus = me.amanullah.course.common.publication.PublishStatus.PUBLISHED
              and (c.publishAt is null or c.publishAt <= :now)
              and (c.unpublishAt is null or c.unpublishAt > :now)
            """;

    boolean existsBySlug(String slug);

    @EntityGraph(attributePaths = {"instructor"})
    Optional<Course> findBySlug(String slug);

    @EntityGraph(attributePaths = {"instructor"})
    List<Course> findByInstructorIdOrderByUpdatedAtDesc(UUID instructorId);

    @EntityGraph(attributePaths = {"instructor"})
    List<Course> findAllByOrderByUpdatedAtDesc();

    List<Course> findByInstructorId(UUID instructorId);

    long countByInstructorId(UUID instructorId);

    @Query("select c from Course c join fetch c.instructor where c.id = :id")
    Optional<Course> findWithInstructor(@Param("id") UUID id);

    /** Locks the course row; used to serialize capacity checks when approving enrollments. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.id = :id")
    Optional<Course> lockById(@Param("id") UUID id);

    @Query(value = "select c from Course c join fetch c.instructor where " + LIVE + """
              and (:level is null or c.level = :level)
              and (:q is null or lower(c.title) like :q or lower(c.subtitle) like :q or lower(c.description) like :q
                   or exists (select 1 from Course c2 join c2.tags t where c2 = c and lower(t) like :q))
            """,
            countQuery = "select count(c) from Course c where " + LIVE + """
              and (:level is null or c.level = :level)
              and (:q is null or lower(c.title) like :q or lower(c.subtitle) like :q or lower(c.description) like :q
                   or exists (select 1 from Course c2 join c2.tags t where c2 = c and lower(t) like :q))
            """)
    Page<Course> searchLive(@Param("q") String q, @Param("level") CefrLevel level, @Param("now") Instant now,
                            Pageable pageable);

    @Query("select count(c) from Course c where " + LIVE)
    long countLive(@Param("now") Instant now);

    @Query("select count(c) from Course c where c.instructor.id = :instructorId and " + LIVE)
    long countLiveByInstructor(@Param("instructorId") UUID instructorId, @Param("now") Instant now);

    @Query("""
            select c from Course c where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and c.publishStatus = :status
              and ((c.publishAt >= :from and c.publishAt <= :to) or (c.unpublishAt >= :from and c.unpublishAt <= :to))
            """)
    List<Course> findScheduled(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                               @Param("status") PublishStatus status, @Param("from") Instant from, @Param("to") Instant to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Course c where c.id = :id")
    void deleteCourseById(@Param("id") UUID id);
}
