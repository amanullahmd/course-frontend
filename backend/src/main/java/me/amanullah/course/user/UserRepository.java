package me.amanullah.course.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Users are never hard-deleted: a deleted account is anonymised ({@link User#anonymize}) so that course data of
 * other people (enrollments, attempts, statistics) is kept and no cascading FK can remove it. The delete methods
 * inherited from {@link JpaRepository} therefore throw.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    String NO_DELETE = "Users are never deleted; use account deletion (anonymisation) instead";

    @Override
    default void delete(User entity) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteById(UUID id) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAllById(Iterable<? extends UUID> ids) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAll(Iterable<? extends User> entities) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAll() {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAllInBatch(Iterable<User> entities) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAllByIdInBatch(Iterable<UUID> ids) {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    @Override
    default void deleteAllInBatch() {
        throw new UnsupportedOperationException(NO_DELETE);
    }

    long countByRoleAndInstructorStatus(Role role, InstructorStatus status);

    long countByRoleAndEnabledTrue(Role role);

    @Query("select u.instructorStatus from User u where u.id = :id")
    Optional<InstructorStatus> findInstructorStatus(@Param("id") UUID id);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    long countByRole(Role role);

    @Query("select new me.amanullah.course.user.AccountState(u.enabled, u.role) from User u where u.id = :id")
    Optional<AccountState> findAccountState(@Param("id") UUID id);

    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:q is null or lower(u.fullName) like :q or lower(u.email) like :q)
            """)
    Page<User> search(@Param("q") String q, @Param("role") Role role, Pageable pageable);

    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:status is null or u.instructorStatus = :status)
              and (:q is null or lower(u.fullName) like :q or lower(u.email) like :q)
            """)
    Page<User> search(@Param("q") String q, @Param("role") Role role, @Param("status") InstructorStatus status,
                      Pageable pageable);
}
