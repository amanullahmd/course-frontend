package me.amanullah.course.course;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReleasePrerequisiteRepository extends JpaRepository<ReleasePrerequisite, UUID> {

    /** All prerequisites whose target is a module or item of the course. */
    @Query("""
            select p from ReleasePrerequisite p
            where (p.targetType = me.amanullah.course.course.ReleaseTarget.MODULE
                   and p.targetId in (select m.id from CourseModule m where m.course.id = :courseId))
               or (p.targetType = me.amanullah.course.course.ReleaseTarget.ITEM
                   and p.targetId in (select i.id from ContentItem i where i.module.course.id = :courseId))
            """)
    List<ReleasePrerequisite> findByCourse(@Param("courseId") UUID courseId);

    List<ReleasePrerequisite> findByTargetTypeAndTargetId(ReleaseTarget targetType, UUID targetId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ReleasePrerequisite p where p.targetType = :type and p.targetId in :ids")
    void deleteByTargets(@Param("type") ReleaseTarget type, @Param("ids") Collection<UUID> ids);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from ReleasePrerequisite p
            where (p.targetType = me.amanullah.course.course.ReleaseTarget.MODULE
                   and p.targetId in (select m.id from CourseModule m where m.course.id = :courseId))
               or (p.targetType = me.amanullah.course.course.ReleaseTarget.ITEM
                   and p.targetId in (select i.id from ContentItem i where i.module.course.id = :courseId))
            """)
    void deleteByCourse(@Param("courseId") UUID courseId);
}
