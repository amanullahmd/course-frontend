package me.amanullah.course.certificate;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CertificateSettingsRepository extends JpaRepository<CertificateSettings, UUID> {
}
