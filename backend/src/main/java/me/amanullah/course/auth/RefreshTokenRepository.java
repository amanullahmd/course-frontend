package me.amanullah.course.auth;

import me.amanullah.course.user.User;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    @Query("select t from RefreshToken t join fetch t.user where t.tokenHash = :hash")
    Optional<RefreshToken> findByTokenHash(@Param("hash") String hash);

    @Modifying
    @Query("""
            update RefreshToken t set t.revokedAt = :now
            where t.user = :user and t.revokedAt is null and (:keepHash is null or t.tokenHash <> :keepHash)
            """)
    int revokeAll(@Param("user") User user, @Param("now") Instant now, @Param("keepHash") String keepHash);

    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :before")
    int deleteExpired(@Param("before") Instant before);
}
