package de.sprachweg.auth;

import de.sprachweg.user.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, UUID> {

    Optional<VerificationToken> findByTokenAndType(String token, TokenType type);

    List<VerificationToken> findByUserAndTypeOrderByCreatedAtDesc(User user, TokenType type);

    @Modifying
    @Query("update VerificationToken t set t.usedAt = :now where t.user = :user and t.type = :type and t.usedAt is null")
    int invalidateAll(@Param("user") User user, @Param("type") TokenType type, @Param("now") Instant now);
}
