package de.sprachweg.media;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<MediaAsset, UUID> {
}
