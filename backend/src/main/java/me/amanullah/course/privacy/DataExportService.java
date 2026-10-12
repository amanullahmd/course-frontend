package me.amanullah.course.privacy;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.media.FileNames;
import me.amanullah.course.media.FileStorage;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaRepository;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * "Download my data" (DSGVO Art. 15/20): a ZIP with {@code profile.json}, {@code enrollments.json},
 * {@code progress.json}, {@code attempts.json} (with answers), {@code notifications.json}, {@code messages.json}
 * and {@code certificates.json} (when those features exist), {@code courses.json} (instructors), {@code files.json}
 * and the user's uploads under {@code files/}. The JSON is collected in one read-only transaction; the ZIP (including
 * the files) is then streamed to the client.
 */
@Service
public class DataExportService {

    private static final Logger log = LoggerFactory.getLogger(DataExportService.class);

    /** Collected data: JSON documents by entry name plus the uploads to stream. */
    public record Export(Map<String, byte[]> documents, List<FileEntry> files) {
    }

    public record FileEntry(String path, String storageKey) {
    }

    private final UserRepository users;
    private final MediaRepository media;
    private final FileStorage storage;
    private final JdbcClient jdbc;
    private final SchemaInfo schema;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public DataExportService(UserRepository users, MediaRepository media, FileStorage storage, JdbcClient jdbc,
                             SchemaInfo schema, ObjectMapper objectMapper, Clock clock) {
        this.users = users;
        this.media = media;
        this.storage = storage;
        this.jdbc = jdbc;
        this.schema = schema;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Export collect(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> NotFoundException.of("User"));
        Map<String, byte[]> docs = new LinkedHashMap<>();

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", u.getId().toString());
        profile.put("fullName", u.getFullName());
        profile.put("email", u.getEmail());
        profile.put("role", u.getRole().name());
        profile.put("instructorStatus", u.getInstructorStatus() == null ? null : u.getInstructorStatus().name());
        profile.put("emailVerified", u.isEmailVerified());
        profile.put("enabled", u.isEnabled());
        profile.put("bio", u.getBio());
        profile.put("locale", u.getLocale());
        profile.put("avatarFile", u.getAvatar() == null ? null : filePath(u.getAvatar()));
        profile.put("termsAcceptedAt", iso(u.getTermsAcceptedAt()));
        profile.put("createdAt", iso(u.getCreatedAt()));
        profile.put("updatedAt", iso(u.getUpdatedAt()));
        profile.put("exportedAt", iso(Instant.now(clock)));
        docs.put("profile.json", json(profile));

        docs.put("enrollments.json", json(rows("""
                select e.id, c.title as course_title, c.slug as course_slug, e.status, e.message, e.decision_reason,
                       e.applied_at, e.decided_at
                from enrollments e join courses c on c.id = e.course_id
                where e.student_id = :id order by e.applied_at
                """, userId)));

        docs.put("progress.json", json(rows("""
                select c.title as course_title, m.title as module_title, i.title as item_title, i.item_type,
                       p.completed_at
                from item_progress p
                join content_items i on i.id = p.item_id
                join course_modules m on m.id = i.module_id
                join courses c on c.id = m.course_id
                where p.student_id = :id order by p.completed_at
                """, userId)));

        docs.put("attempts.json", json(attempts(userId)));

        docs.put("notifications.json", json(rows("""
                select type, title, body, link, read_at, created_at from notifications
                where user_id = :id order by created_at
                """, userId)));

        if (schema.hasTable("messages") && schema.hasTable("conversations")) {
            docs.put("messages.json", json(rows("""
                    select m.conversation_id, c.course_id, s.full_name as sender_name,
                           case when m.sender_id = :id then true else false end as sent_by_me, m.body, m.created_at
                    from messages m
                    join conversations c on c.id = m.conversation_id
                    join users s on s.id = m.sender_id
                    where c.participant_a_id = :id or c.participant_b_id = :id
                    order by m.conversation_id, m.created_at
                    """, userId)));
        }

        if (schema.hasTable("certificates")) {
            docs.put("certificates.json", json(rows("""
                    select code, course_title, learner_name, cefr_level, instructor_name, completed_at, final_score,
                           issued_at, revoked_at
                    from certificates where student_id = :id order by issued_at
                    """, userId)));
        }

        List<Map<String, Object>> owned = rows("""
                select id, title, slug, cefr_level, publish_status, created_at, updated_at
                from courses where instructor_id = :id order by created_at
                """, userId);
        if (!owned.isEmpty()) {
            docs.put("courses.json", json(owned));
        }

        List<FileEntry> files = new ArrayList<>();
        List<Map<String, Object>> fileMeta = new ArrayList<>();
        for (MediaAsset m : media.findByOwnerIdOrderByCreatedAt(userId)) {
            String path = filePath(m);
            files.add(new FileEntry(path, m.getStorageKey()));
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("path", path);
            meta.put("fileName", m.getOriginalName());
            meta.put("contentType", m.getContentType());
            meta.put("sizeBytes", m.getSizeBytes());
            meta.put("uploadedAt", iso(m.getCreatedAt()));
            fileMeta.add(meta);
        }
        docs.put("files.json", json(fileMeta));
        docs.put("README.txt", readme(u.getLocale()).getBytes(StandardCharsets.UTF_8));
        return new Export(docs, files);
    }

    /** Writes the export as a ZIP; uploads that are missing on disk are skipped. */
    public void writeZip(Export export, OutputStream out) throws IOException {
        ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8);
        for (Map.Entry<String, byte[]> doc : export.documents().entrySet()) {
            zip.putNextEntry(new ZipEntry(doc.getKey()));
            zip.write(doc.getValue());
            zip.closeEntry();
        }
        for (FileEntry file : export.files()) {
            Resource resource = storage.load(file.storageKey());
            if (!resource.exists()) {
                log.warn("Export: file {} missing in storage", file.storageKey());
                continue;
            }
            zip.putNextEntry(new ZipEntry(file.path()));
            try (InputStream in = resource.getInputStream()) {
                in.transferTo(zip);
            }
            zip.closeEntry();
        }
        zip.finish();
        zip.flush();
    }

    private List<Map<String, Object>> attempts(UUID userId) {
        List<Map<String, Object>> attempts = rows("""
                select a.id, c.title as course_title, i.title as item_title, i.item_type, a.status, a.started_at,
                       a.deadline, a.submitted_at, a.score, a.max_score, a.late
                from attempts a
                join assessments s on s.id = a.assessment_id
                join content_items i on i.id = s.item_id
                join course_modules m on m.id = i.module_id
                join courses c on c.id = m.course_id
                where a.student_id = :id order by a.started_at
                """, userId);
        List<Map<String, Object>> answers = rows("""
                select aa.id, aa.attempt_id, aa.sort_order, aa.question_type, aa.prompt, aa.text_answer, aa.correct,
                       aa.points, aa.points_awarded, aa.feedback
                from attempt_answers aa join attempts a on a.id = aa.attempt_id
                where a.student_id = :id order by aa.attempt_id, aa.sort_order
                """, userId);
        List<Map<String, Object>> selections = rows("""
                select sel.answer_id, o.option_text
                from attempt_answer_selections sel
                join attempt_answer_options o on o.answer_id = sel.answer_id and o.option_id = sel.option_id
                join attempt_answers aa on aa.id = sel.answer_id
                join attempts a on a.id = aa.attempt_id
                where a.student_id = :id order by sel.answer_id, o.sort_order
                """, userId);
        Map<Object, List<String>> selected = new LinkedHashMap<>();
        selections.forEach(s -> selected.computeIfAbsent(s.get("answerId"), k -> new ArrayList<>())
                .add(String.valueOf(s.get("optionText"))));
        Map<Object, List<Map<String, Object>>> byAttempt = new LinkedHashMap<>();
        for (Map<String, Object> answer : answers) {
            Object answerId = answer.remove("id");
            answer.put("selectedOptions", selected.getOrDefault(answerId, List.of()));
            byAttempt.computeIfAbsent(answer.remove("attemptId"), k -> new ArrayList<>()).add(answer);
        }
        attempts.forEach(a -> a.put("answers", byAttempt.getOrDefault(a.get("id"), List.of())));
        return attempts;
    }

    private List<Map<String, Object>> rows(String sql, UUID userId) {
        return jdbc.sql(sql).param("id", userId).query().listOfRows().stream().map(DataExportService::normalize)
                .toList();
    }

    /** snake_case → camelCase keys, timestamps → ISO-8601 UTC strings, UUIDs → strings. */
    private static Map<String, Object> normalize(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((k, v) -> out.put(camel(k), value(v)));
        return out;
    }

    private static Object value(Object v) {
        return switch (v) {
            case null -> null;
            case Timestamp t -> t.toInstant().toString();
            case OffsetDateTime o -> o.toInstant().toString();
            case ZonedDateTime z -> z.toInstant().toString();
            case Instant i -> i.toString();
            case UUID id -> id.toString();
            default -> v;
        };
    }

    private static String camel(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        StringBuilder sb = new StringBuilder();
        boolean up = false;
        for (char c : lower.toCharArray()) {
            if (c == '_') {
                up = true;
            } else {
                sb.append(up ? Character.toUpperCase(c) : c);
                up = false;
            }
        }
        return sb.toString();
    }

    private static String iso(Instant instant) {
        return instant == null ? null : instant.toString();
    }

    private static String filePath(MediaAsset m) {
        return "files/" + m.getId() + "_" + FileNames.sanitize(m.getOriginalName()).replace('/', '_');
    }

    private byte[] json(Object value) {
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(value);
    }

    private static String readme(String locale) {
        if ("de".equals(locale)) {
            return """
                    Sprachweg – Export deiner Daten (Art. 15 und 20 DSGVO)

                    profile.json        Dein Profil
                    enrollments.json    Deine Kurs-Anmeldungen
                    progress.json       Abgeschlossene Lerneinheiten
                    attempts.json       Quiz- und Prüfungsversuche mit deinen Antworten und Bewertungen
                    notifications.json  Benachrichtigungen
                    messages.json       Nachrichten (falls vorhanden)
                    certificates.json   Zertifikate (falls vorhanden)
                    courses.json        Deine Kurse als Lehrkraft (falls vorhanden)
                    files.json, files/  Deine hochgeladenen Dateien
                    """;
        }
        return """
                Sprachweg – export of your data (GDPR Art. 15 and 20)

                profile.json        Your profile
                enrollments.json    Your course enrollments
                progress.json       Completed learning items
                attempts.json       Quiz and exam attempts with your answers and grades
                notifications.json  Notifications
                messages.json       Messages (if any)
                certificates.json   Certificates (if any)
                courses.json        Your courses as an instructor (if any)
                files.json, files/  Your uploaded files
                """;
    }
}
