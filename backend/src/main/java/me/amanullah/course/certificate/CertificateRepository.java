package me.amanullah.course.certificate;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CertificateRepository extends JpaRepository<Certificate, UUID> {

    @Query("""
            select c from Certificate c join fetch c.course co join fetch co.instructor join fetch c.student
            where c.id = :id
            """)
    Optional<Certificate> findWithContext(@Param("id") UUID id);

    @Query("select c from Certificate c join fetch c.course co join fetch co.instructor where c.code = :code")
    Optional<Certificate> findByCode(@Param("code") String code);

    boolean existsByCode(String code);

    /** The active certificate of a learner for a course (at most one, see the unique constraint). */
    @Query("""
            select c from Certificate c where c.course.id = :courseId and c.student.id = :studentId
              and c.revokedAt is null
            """)
    Optional<Certificate> findActive(@Param("courseId") UUID courseId, @Param("studentId") UUID studentId);

    /** All certificates (active and revoked) of a learner for a course, newest first. */
    @Query("""
            select c from Certificate c where c.course.id = :courseId and c.student.id = :studentId
            order by c.issuedAt desc
            """)
    List<Certificate> findByCourseAndStudent(@Param("courseId") UUID courseId, @Param("studentId") UUID studentId);

    @Query("""
            select c from Certificate c join fetch c.student join fetch c.course
            where c.course.id = :courseId order by c.issuedAt desc, c.id
            """)
    List<Certificate> findByCourse(@Param("courseId") UUID courseId);

    @Query("""
            select c from Certificate c join fetch c.course co join fetch co.instructor
            where c.student.id = :studentId order by c.issuedAt desc, c.id
            """)
    List<Certificate> findByStudent(@Param("studentId") UUID studentId);

    @Query("""
            select c from Certificate c where c.student.id = :studentId and c.course.id in :courseIds
              and c.revokedAt is null
            """)
    List<Certificate> findActiveForCourses(@Param("studentId") UUID studentId,
                                           @Param("courseIds") Collection<UUID> courseIds);
}
