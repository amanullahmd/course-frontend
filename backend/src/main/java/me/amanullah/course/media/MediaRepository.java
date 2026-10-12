package me.amanullah.course.media;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaRepository extends JpaRepository<MediaAsset, UUID> {

    /** Total size of all media owned by the user (storage quota). */
    @Query("select coalesce(sum(m.sizeBytes), 0) from MediaAsset m where m.owner.id = :ownerId")
    long sumSizeByOwner(@Param("ownerId") UUID ownerId);

    List<MediaAsset> findByOwnerIdOrderByCreatedAt(UUID ownerId);
}
