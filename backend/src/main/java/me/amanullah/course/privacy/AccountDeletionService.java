package me.amanullah.course.privacy;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.auth.RefreshTokenService;
import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.common.util.Tokens;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.media.FileStorage;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaRepository;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * "Delete my account" (DSGVO Art. 17). Users are never hard-deleted; the account is anonymised instead:
 * <ul>
 *   <li>name "Deleted user" / "Gelöschte:r Nutzer:in" (in the user's language), e-mail {@code deleted-<id>@invalid},
 *       random password, disabled, avatar and bio removed, locale kept;</li>
 *   <li>enrollments, attempts (with answers) and progress stay, now pointing at the anonymous account, so the
 *       instructors' statistics remain correct; application messages are cleared;</li>
 *   <li>the user's uploads are deleted (rows and files) unless course content uses them;</li>
 *   <li>refresh and verification tokens and notifications are deleted; certificates are revoked and their
 *       learner name is anonymised.</li>
 * </ul>
 * Blocked with 409 {@code HAS_COURSES} while the user owns courses and with 409 {@code LAST_ADMIN} for the last
 * active admin.
 */
@Service
public class AccountDeletionService {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

    public static final String CONFIRM_WORD = "DELETE";

    private record MediaReference(String table, String column, String countSql) {
        MediaReference(String table, String column) {
            this(table, column, "select count(*) from " + table + " where " + column + " = :id");
        }
    }

    /** Places where course content references media; such media survive the owner's deletion. */
    private static final List<MediaReference> COURSE_MEDIA_REFERENCES = List.of(
            new MediaReference("courses", "cover_image_id"),
            new MediaReference("content_item_attachments", "media_id"),
            new MediaReference("questions", "media_id"),
            new MediaReference("certificate_settings", "signature_image_id"));

    private final UserRepository users;
    private final CourseRepository courses;
    private final MediaRepository media;
    private final FileStorage storage;
    private final RefreshTokenService refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final Messages messages;
    private final JdbcClient jdbc;
    private final SchemaInfo schema;
    private final Clock clock;

    public AccountDeletionService(UserRepository users, CourseRepository courses, MediaRepository media,
                                  FileStorage storage, RefreshTokenService refreshTokens,
                                  PasswordEncoder passwordEncoder, Messages messages, JdbcClient jdbc,
                                  SchemaInfo schema, Clock clock) {
        this.users = users;
        this.courses = courses;
        this.media = media;
        this.storage = storage;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.messages = messages;
        this.jdbc = jdbc;
        this.schema = schema;
        this.clock = clock;
    }

    @Transactional
    public void deleteOwnAccount(UUID userId, String password, String confirm) {
        User user = users.findById(userId).orElseThrow(() -> NotFoundException.of("User"));
        if (!CONFIRM_WORD.equals(confirm == null ? null : confirm.strip())) {
            throw ValidationException.field("confirm", "validation.confirmDelete", CONFIRM_WORD);
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadRequestException("INVALID_PASSWORD", "The current password is incorrect");
        }
        long owned = courses.countByInstructorId(userId);
        if (owned > 0) {
            throw new ConflictException("HAS_COURSES", "Transfer or delete your courses first")
                    .key("error.HAS_COURSES", owned);
        }
        if (user.getRole() == Role.ADMIN && users.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new ConflictException("LAST_ADMIN", "The last administrator cannot delete their account");
        }

        Instant now = Instant.now(clock);
        List<MediaAsset> uploads = media.findByOwnerIdOrderByCreatedAt(userId);
        user.anonymize(messages.get(user.preferredLocale(), "user.deletedName"),
                passwordEncoder.encode(Tokens.random()), now);
        refreshTokens.revokeAll(user);
        users.flush();

        int deletedFiles = 0;
        for (MediaAsset asset : uploads) {
            if (usedByCourseContent(asset.getId())) {
                continue;
            }
            String key = asset.getStorageKey();
            media.delete(asset);
            deletedFiles++;
            afterCommit(() -> storage.delete(key));
        }
        media.flush();

        jdbc.sql("delete from verification_tokens where user_id = :id").param("id", userId).update();
        jdbc.sql("delete from notifications where user_id = :id").param("id", userId).update();
        jdbc.sql("update enrollments set message = null where student_id = :id").param("id", userId).update();
        if (schema.hasTable("certificates") && schema.hasColumn("certificates", "learner_name")) {
            jdbc.sql("update certificates set learner_name = :name where student_id = :id")
                    .param("name", user.getFullName()).param("id", userId).update();
            if (schema.hasColumn("certificates", "active_student_id") && schema.hasColumn("certificates", "revoked_at")) {
                jdbc.sql("""
                        update certificates set active_student_id = null, revoked_at = :now,
                               revoked_reason = 'Account deleted'
                        where student_id = :id and revoked_at is null
                        """).param("now", now.atOffset(java.time.ZoneOffset.UTC)).param("id", userId).update();
            }
        }
        log.info("Account {} deleted (anonymised), {} uploads removed", userId, deletedFiles);
    }

    private boolean usedByCourseContent(UUID mediaId) {
        for (MediaReference ref : COURSE_MEDIA_REFERENCES) {
            if (!schema.hasColumn(ref.table(), ref.column())) {
                continue;
            }
            Long n = jdbc.sql(ref.countSql()).param("id", mediaId).query(Long.class).single();
            if (n != null && n > 0) {
                return true;
            }
        }
        return false;
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
