package me.amanullah.course.enrollment;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseInvitationRepository extends JpaRepository<CourseInvitation, UUID> {

    /** Lower-cased addresses invited to the course since {@code since}. */
    @Query("""
            select distinct i.email from CourseInvitation i
            where i.course.id = :courseId and i.email in :emails and i.createdAt > :since
            """)
    List<String> findRecentlyInvited(@Param("courseId") UUID courseId, @Param("emails") Collection<String> emails,
                                     @Param("since") Instant since);
}
