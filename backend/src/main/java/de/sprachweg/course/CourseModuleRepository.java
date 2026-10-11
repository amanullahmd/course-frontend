package de.sprachweg.course;

import de.sprachweg.common.publication.PublishStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseModuleRepository extends JpaRepository<CourseModule, UUID> {

    @Query("select m from CourseModule m join fetch m.course c join fetch c.instructor where m.id = :id")
    Optional<CourseModule> findWithCourse(@Param("id") UUID id);

    List<CourseModule> findByCourseIdOrderByPositionAsc(UUID courseId);

    long countByCourseId(UUID courseId);

    @Query("""
            select m from CourseModule m join fetch m.course c
            where (:instructorId is null or c.instructor.id = :instructorId)
              and (:courseId is null or c.id = :courseId)
              and m.publishStatus = :status
              and ((m.publishAt >= :from and m.publishAt <= :to) or (m.unpublishAt >= :from and m.unpublishAt <= :to))
            """)
    List<CourseModule> findScheduled(@Param("instructorId") UUID instructorId, @Param("courseId") UUID courseId,
                                     @Param("status") PublishStatus status, @Param("from") Instant from,
                                     @Param("to") Instant to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from CourseModule m where m.id = :id")
    void deleteModuleById(@Param("id") UUID id);
}
