package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import me.amanullah.course.security.RateLimiter;
import me.amanullah.course.user.InstructorStatus;
import me.amanullah.course.user.Role;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Security & privacy (P0-5/P0-6) with the production defaults switched on: rate limits, instructor approval,
 * required terms acceptance, small storage quotas, upload type rules, account deletion and data export. Uses its own
 * in-memory database, so admin counts are deterministic.
 */
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:sprachweg-security;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "app.rate-limit.enabled=true",
        "app.registration.instructor-approval-required=true",
        "app.registration.terms-required=true",
        "app.storage.quota.student=12KB",
        "app.storage.quota.instructor=1MB"})
class SecurityPrivacyTest extends IntegrationTestSupport {

    private static final AtomicInteger IPS = new AtomicInteger(1);

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private LockProvider lockProvider;

    @BeforeEach
    void resetLimits() {
        rateLimiter.reset();
    }

    // ---------------------------------------------------------------- helpers

    /** A fresh client address per call, so that only the tests about rate limits ever hit them. */
    private static String freshIp() {
        int n = IPS.getAndIncrement();
        return "10.1." + (n / 250) + "." + (n % 250 + 1);
    }

    private static MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder builder, String ip) {
        return builder.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private void register(String email, String role, Boolean acceptTerms) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("fullName", "Test " + role, "email", email,
                "password", PASSWORD, "role", role));
        if (acceptTerms != null) {
            body.put("acceptTerms", acceptTerms);
        }
        mvc.perform(from(jsonBody(post("/api/auth/register"), body), freshIp())).andExpect(status().isCreated());
    }

    private String signUpWithTerms(String email, String role) throws Exception {
        register(email, role, true);
        mvc.perform(from(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email))), freshIp()))
                .andExpect(status().isOk());
        return loginFrom(email, freshIp());
    }

    private String loginFrom(String email, String ip) throws Exception {
        MvcResult r = mvc.perform(from(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)), ip))
                .andExpect(status().isOk()).andReturn();
        return read(r, "$.accessToken");
    }

    private String admin() throws Exception {
        String email = uniqueEmail("admin");
        signUpWithTerms(email, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(email).orElseThrow().setRole(Role.ADMIN));
        return loginFrom(email, freshIp());
    }

    private String approvedInstructor() throws Exception {
        String email = uniqueEmail("teacher");
        signUpWithTerms(email, "INSTRUCTOR");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(email).orElseThrow()
                .setInstructorStatus(InstructorStatus.APPROVED));
        return loginFrom(email, freshIp());
    }

    private String me(String token) throws Exception {
        return read(mvc.perform(auth(get("/api/users/me"), token)).andExpect(status().isOk()).andReturn(), "$.id");
    }

    private MvcResult upload(String token, MockMultipartFile file) throws Exception {
        return mvc.perform(multipart("/api/media").file(file).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andReturn();
    }

    private static String pathAndQuery(String url) {
        URI uri = URI.create(url);
        return uri.getRawPath() + "?" + uri.getRawQuery();
    }

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R'};

    // ---------------------------------------------------------------- rate limits

    @Test
    void loginIsRateLimitedPerIpWithRetryAfter() throws Exception {
        String ip = freshIp();
        for (int i = 0; i < 10; i++) {
            mvc.perform(from(jsonBody(post("/api/auth/login"),
                            Map.of("email", uniqueEmail("nobody"), "password", "wrong-1234")), ip))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(from(jsonBody(post("/api/auth/login"), Map.of("email", uniqueEmail("nobody"), "password", "x1")), ip)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.retryAfterSeconds").isNumber())
                .andExpect(jsonPath("$.detail").value(containsString("Sekunden")));
        // another client is not affected
        mvc.perform(from(jsonBody(post("/api/auth/login"), Map.of("email", uniqueEmail("nobody"), "password", "x1")),
                freshIp())).andExpect(status().isUnauthorized());
    }

    @Test
    void loginLimitPerEmailDoesNotRevealWhetherTheAccountExists() throws Exception {
        String existing = uniqueEmail("victim");
        signUpWithTerms(existing, "STUDENT");
        rateLimiter.reset(); // the sign-up's own login counted too
        String unknown = uniqueEmail("ghost");
        for (String email : List.of(existing, unknown)) {
            for (int i = 0; i < 5; i++) {
                mvc.perform(from(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", "wrong-1234")),
                        freshIp())).andExpect(status().isUnauthorized())
                        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
            }
            MvcResult limited = mvc.perform(from(jsonBody(post("/api/auth/login"),
                            Map.of("email", email.toUpperCase(), "password", PASSWORD)), freshIp()))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                    .andReturn();
            assertThat(limited.getResponse().getContentAsString()).doesNotContain(email);
        }
    }

    @Test
    void registerAndMailEndpointsAreRateLimited() throws Exception {
        String ip = freshIp();
        for (int i = 0; i < 5; i++) {
            mvc.perform(from(jsonBody(post("/api/auth/register"), Map.of("fullName", "Spam " + i,
                    "email", uniqueEmail("spam"), "password", PASSWORD, "role", "STUDENT", "acceptTerms", true)), ip))
                    .andExpect(status().isCreated());
        }
        mvc.perform(from(jsonBody(post("/api/auth/register"), Map.of("fullName", "Spam", "email", uniqueEmail("spam"),
                        "password", PASSWORD, "role", "STUDENT", "acceptTerms", true)), ip))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists(HttpHeaders.RETRY_AFTER));

        String target = uniqueEmail("bombed");
        for (int i = 0; i < 3; i++) {
            mvc.perform(from(jsonBody(post("/api/auth/forgot-password"), Map.of("email", target)), freshIp()))
                    .andExpect(status().isOk());
        }
        mvc.perform(from(jsonBody(post("/api/auth/forgot-password"), Map.of("email", target)), freshIp()))
                .andExpect(status().isTooManyRequests());

        String tokenIp = freshIp();
        for (int i = 0; i < 20; i++) {
            mvc.perform(from(jsonBody(post("/api/auth/verify-email"), Map.of("token", "nope-" + i)), tokenIp))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(from(jsonBody(post("/api/auth/reset-password"), Map.of("token", "nope", "password", PASSWORD)),
                tokenIp)).andExpect(status().isTooManyRequests());
    }

    // ---------------------------------------------------------------- terms

    @Test
    void registrationRequiresAcceptingTheTerms() throws Exception {
        for (Object accept : new Object[] {null, false}) {
            Map<String, Object> body = new HashMap<>(Map.of("fullName", "No Terms", "email", uniqueEmail("terms"),
                    "password", PASSWORD, "role", "STUDENT"));
            if (accept != null) {
                body.put("acceptTerms", accept);
            }
            mvc.perform(from(jsonBody(post("/api/auth/register"), body), freshIp()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.errors.acceptTerms").isString());
        }
        String email = uniqueEmail("terms");
        register(email, "STUDENT", true);
        Instant accepted = tx.execute(s -> users.findByEmailIgnoreCase(email).orElseThrow().getTermsAcceptedAt());
        assertThat(accepted).isNotNull().isAfter(Instant.now().minus(Duration.ofMinutes(5)));
    }

    // ---------------------------------------------------------------- instructor approval

    @Test
    void pendingInstructorCannotCreateCoursesUntilApproved() throws Exception {
        String email = uniqueEmail("pending");
        String teacher = signUpWithTerms(email, "INSTRUCTOR");
        String id = me(teacher);
        mvc.perform(auth(get("/api/users/me"), teacher)).andExpect(jsonPath("$.instructorStatus").value("PENDING"));
        // profile editing still works
        mvc.perform(auth(jsonBody(put("/api/users/me"), Map.of("fullName", "Paula Pending", "bio", "Hallo")), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/instructor/courses"), teacher)).andExpect(status().isOk());
        Map<String, Object> course = Map.of("title", "Deutsch A1", "level", "A1", "tags", List.of(),
                "enrollmentMode", "OPEN");
        mvc.perform(auth(jsonBody(post("/api/instructor/courses"), course), teacher)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSTRUCTOR_NOT_APPROVED"))
                .andExpect(jsonPath("$.detail").value(containsString("geprüft")));

        String admin = admin();
        mvc.perform(auth(get("/api/admin/stats"), admin)).andExpect(jsonPath("$.pendingInstructors").isNumber());
        mvc.perform(auth(get("/api/admin/users").param("instructorStatus", "PENDING").param("size", "100"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", hasItem(id)))
                .andExpect(jsonPath("$.content[?(@.id == '" + id + "')].instructorStatus").value("PENDING"));
        mvc.perform(auth(post("/api/admin/users/" + id + "/approve-instructor"), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.instructorStatus").value("APPROVED"));
        mvc.perform(auth(get("/api/admin/users").param("instructorStatus", "PENDING").param("size", "100"), admin))
                .andExpect(jsonPath("$.content[*].id", not(hasItem(id))));

        // same access token: the approval is effective immediately
        mvc.perform(auth(jsonBody(post("/api/instructor/courses"), course), teacher)).andExpect(status().isCreated());

        // reject → writes are blocked again
        mvc.perform(auth(jsonBody(post("/api/admin/users/" + id + "/reject-instructor"), Map.of("reason", "Kein Nachweis")),
                admin)).andExpect(status().isOk()).andExpect(jsonPath("$.instructorStatus").value("REJECTED"));
        mvc.perform(auth(jsonBody(post("/api/instructor/courses"), course), teacher))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("INSTRUCTOR_NOT_APPROVED"));
    }

    @Test
    void approvalEndpointsRejectBadInputWith4xx() throws Exception {
        String admin = admin();
        String student = signUpWithTerms(uniqueEmail("stud"), "STUDENT");
        String studentId = me(student);
        mvc.perform(auth(post("/api/admin/users/not-a-uuid/approve-instructor"), admin)).andExpect(status().isBadRequest());
        mvc.perform(auth(post("/api/admin/users/" + UUID.randomUUID() + "/approve-instructor"), admin))
                .andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/admin/users/" + studentId + "/approve-instructor"), admin))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_AN_INSTRUCTOR"));
        mvc.perform(auth(post("/api/admin/users/" + studentId + "/reject-instructor"), admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{bad json"))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/admin/users").param("instructorStatus", "MAYBE"), admin))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(post("/api/admin/users/" + studentId + "/approve-instructor"), student))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- uploads

    @Test
    void studentQuotaIsEnforcedWithUsageInfo() throws Exception {
        String student = signUpWithTerms(uniqueEmail("quota"), "STUDENT");
        mvc.perform(auth(get("/api/media/usage"), student)).andExpect(status().isOk())
                .andExpect(jsonPath("$.usedBytes").value(0)).andExpect(jsonPath("$.quotaBytes").value(12 * 1024));
        byte[] text = "Hallo Welt! ".repeat(750).getBytes(StandardCharsets.UTF_8); // 9000 bytes
        assertThat(upload(student, new MockMultipartFile("file", "a.txt", "text/plain", text)).getResponse().getStatus())
                .isEqualTo(201);
        mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "b.txt", "text/plain", text))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student).header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.usedBytes").value(9000))
                .andExpect(jsonPath("$.quotaBytes").value(12 * 1024))
                .andExpect(jsonPath("$.detail").value(containsString("Speicher")));
        mvc.perform(auth(get("/api/media/usage"), student)).andExpect(jsonPath("$.usedBytes").value(9000));

        String admin = admin();
        mvc.perform(auth(get("/api/media/usage"), admin)).andExpect(jsonPath("$.quotaBytes").isEmpty());
        mvc.perform(get("/api/media/usage")).andExpect(status().isUnauthorized());
    }

    @Test
    void studentUploadsAreLimitedToTheAllowList() throws Exception {
        String student = signUpWithTerms(uniqueEmail("allow"), "STUDENT");
        record Case(String name, String type, byte[] content, int status) {
        }
        List<Case> cases = List.of(
                new Case("tool.exe", "application/octet-stream", "MZ".getBytes(StandardCharsets.US_ASCII), 415),
                new Case("page.html", "text/html", "<html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8), 415),
                new Case("image.svg", "image/svg+xml", "<svg onload=alert(1)/>".getBytes(StandardCharsets.UTF_8), 415),
                new Case("fake.png", "image/png", "not really a png".getBytes(StandardCharsets.UTF_8), 415),
                new Case("notes.txt", "text/plain", "<!doctype html><script>x</script>".getBytes(StandardCharsets.UTF_8), 415),
                new Case("archive.zip", "application/zip", zip("a.txt"), 415),
                new Case("fake.docx", "application/octet-stream", zip("other.xml"), 415),
                new Case("clip.webm", "video/webm", new byte[] {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 1, 2}, 415),
                new Case("photo.png", "text/html", PNG, 201),
                new Case("essay.docx", "application/octet-stream", zip("[Content_Types].xml", "word/document.xml"), 201),
                new Case("note.txt", "text/plain", "Tschüss!".getBytes(StandardCharsets.UTF_8), 201),
                new Case("doc.pdf", "application/pdf", "%PDF-1.4\n%".getBytes(StandardCharsets.US_ASCII), 201),
                new Case("answer.webm", "audio/webm", new byte[] {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 1, 2}, 201));
        for (Case c : cases) {
            MvcResult r = upload(student, new MockMultipartFile("file", c.name(), c.type(), c.content()));
            assertThat(r.getResponse().getStatus()).as(c.name()).isEqualTo(c.status());
            if (c.status() == 415) {
                assertThat(r.getResponse().getContentAsString()).as(c.name()).contains("FILE_TYPE_NOT_ALLOWED");
            }
        }
        // the stored type comes from the verified extension, not from the declared Content-Type
        MvcResult png = upload(student, new MockMultipartFile("file", "x.png", "text/html", PNG));
        assertThat((String) read(png, "$.contentType")).isEqualTo("image/png");
    }

    @Test
    void instructorsCannotUploadExecutablesAndActiveContentIsServedAsAttachment() throws Exception {
        String teacher = approvedInstructor();
        assertThat(upload(teacher, new MockMultipartFile("file", "setup.exe", "application/octet-stream",
                new byte[] {'M', 'Z', 0, 0})).getResponse().getStatus()).isEqualTo(415);
        assertThat(upload(teacher, new MockMultipartFile("file", "run.sh", "text/plain",
                "#!/bin/sh\necho hi".getBytes(StandardCharsets.UTF_8))).getResponse().getStatus()).isEqualTo(415);
        assertThat(upload(teacher, new MockMultipartFile("file", "app.js", "text/javascript",
                "alert(1)".getBytes(StandardCharsets.UTF_8))).getResponse().getStatus()).isEqualTo(415);
        byte[] elf = {0x7F, 'E', 'L', 'F', 2, 1, 1, 0};
        assertThat(upload(teacher, new MockMultipartFile("file", "handout.pdf", "application/pdf", elf))
                .getResponse().getStatus()).isEqualTo(415);
        assertThat(upload(teacher, new MockMultipartFile("file", "slides.zip", "application/zip", zip("a.txt")))
                .getResponse().getStatus()).isEqualTo(201);

        MvcResult svg = upload(teacher, new MockMultipartFile("file", "diagram.svg", "image/svg+xml",
                "<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"/>".getBytes(StandardCharsets.UTF_8)));
        assertThat(svg.getResponse().getStatus()).isEqualTo(201);
        mvc.perform(get(pathAndQuery(read(svg, "$.url"))))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment;")))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/octet-stream"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        // an SVG uploaded with a harmless declared type is still recognised by its extension
        MvcResult disguised = upload(teacher, new MockMultipartFile("file", "logo.svg", "text/plain",
                "<svg/>".getBytes(StandardCharsets.UTF_8)));
        mvc.perform(get(pathAndQuery(read(disguised, "$.url"))))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment;")));

        MvcResult txt = upload(teacher, new MockMultipartFile("file", "words.txt", "text/plain",
                "Hallo".getBytes(StandardCharsets.UTF_8)));
        mvc.perform(get(pathAndQuery(read(txt, "$.url"))))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("inline;")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", startsWith("sandbox; frame-ancestors")))
                .andExpect(header().doesNotExist("X-Frame-Options"));
        MvcResult pdf = upload(teacher, new MockMultipartFile("file", "handout.pdf", "application/pdf",
                "%PDF-1.4\n%".getBytes(StandardCharsets.US_ASCII)));
        mvc.perform(get(pathAndQuery(read(pdf, "$.url"))))
                .andExpect(header().string("Content-Security-Policy", startsWith("frame-ancestors")));
    }

    @Test
    void uploadsAreRateLimitedPerUser() throws Exception {
        String teacher = approvedInstructor();
        for (int i = 0; i < 60; i++) {
            assertThat(upload(teacher, new MockMultipartFile("file", "f" + i + ".txt", "text/plain", new byte[] {'a'}))
                    .getResponse().getStatus()).isEqualTo(201);
        }
        MvcResult limited = upload(teacher, new MockMultipartFile("file", "f.txt", "text/plain", new byte[] {'a'}));
        assertThat(limited.getResponse().getStatus()).isEqualTo(429);
        assertThat(limited.getResponse().getHeader(HttpHeaders.RETRY_AFTER)).isNotBlank();
    }

    // ---------------------------------------------------------------- account deletion & export

    /** An approved instructor with an OPEN course containing a quiz. Returns {teacherToken, courseId, quizItemId}. */
    private String[] courseWithQuiz() throws Exception {
        String teacher = approvedInstructor();
        String courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of("title", "Deutsch A1 DSGVO",
                "level", "A1", "tags", List.of(), "enrollmentMode", "OPEN")), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/courses/" + courseId);
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 1")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/modules/" + moduleId);
        Map<String, Object> item = new HashMap<>(Map.of("type", "QUIZ", "title", "Quiz 1", "body", "<p>x</p>",
                "attachmentIds", List.of()));
        String quizId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"), item), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/items/" + quizId);
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), Map.of("passingScore", 50,
                "questions", List.of(Map.of("type", "SHORT_ANSWER", "prompt", "21 in Worten", "points", 1,
                        "acceptedAnswers", List.of("einundzwanzig"))))), teacher)).andExpect(status().isOk());
        return new String[] {teacher, courseId, quizId};
    }

    private void publish(String token, String base) throws Exception {
        mvc.perform(auth(jsonBody(put(base + "/publication"), Map.of("publishStatus", "PUBLISHED")), token))
                .andExpect(status().isOk());
    }

    @SuppressWarnings("unchecked")
    private String submitAttempt(String student, String quizId, String answer) throws Exception {
        MvcResult session = mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
        String attemptId = read(session, "$.id");
        List<Map<String, Object>> questions = read(session, "$.questions");
        List<Map<String, Object>> answers = new ArrayList<>();
        questions.forEach(q -> answers.add(Map.of("questionId", q.get("id"), "textAnswer", answer)));
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + attemptId + "/submit"), Map.of("answers", answers)),
                student)).andExpect(status().isOk());
        return attemptId;
    }

    @Test
    void deletingAStudentAnonymisesTheAccountAndKeepsAttempts() throws Exception {
        String[] course = courseWithQuiz();
        String email = uniqueEmail("leaving");
        String student = signUpWithTerms(email, "STUDENT");
        String studentId = me(student);
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(email).orElseThrow().setLocale("de"));
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + course[1] + "/enrollments"),
                Map.of("message", "Ich heiße Lena")), student)).andExpect(status().isCreated());
        String attemptId = submitAttempt(student, course[2], "einundzwanzig");
        String avatarId = read(upload(student, new MockMultipartFile("file", "me.png", "image/png", PNG)), "$.id");
        mvc.perform(auth(jsonBody(put("/api/users/me"), Map.of("fullName", "Lena Weg", "bio", "Private Bio",
                "avatarMediaId", avatarId)), student)).andExpect(status().isOk());

        // wrong confirmation word / password, missing body → 4xx and nothing changes
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "delete")), student))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.confirm").isString());
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", "Wrong123!", "confirm", "DELETE")), student))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PASSWORD"));
        mvc.perform(auth(delete("/api/users/me"), student)).andExpect(status().isBadRequest());
        mvc.perform(auth(delete("/api/users/me").contentType(MediaType.APPLICATION_JSON).content("[1,"), student))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")))
                .andExpect(status().isUnauthorized());

        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")), student))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

        tx.executeWithoutResult(s -> {
            var u = users.findById(UUID.fromString(studentId)).orElseThrow();
            assertThat(u.getFullName()).isEqualTo("Gelöschte:r Nutzer:in");
            assertThat(u.getEmail()).isEqualTo("deleted-" + studentId + "@invalid");
            assertThat(u.isEnabled()).isFalse();
            assertThat(u.getBio()).isNull();
            assertThat(u.getAvatar()).isNull();
            assertThat(u.getLocale()).isEqualTo("de");
            assertThat(u.isDeleted()).isTrue();
        });
        // old token and old credentials are dead
        mvc.perform(auth(get("/api/users/me"), student)).andExpect(status().isUnauthorized());
        mvc.perform(from(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)), freshIp()))
                .andExpect(status().isUnauthorized());
        // the uploaded avatar is gone
        mvc.perform(auth(get("/api/media/" + avatarId), admin())).andExpect(status().isNotFound());

        // the instructor still sees the attempt and the enrollment, under the anonymous name
        String teacher = course[0];
        mvc.perform(auth(get("/api/instructor/attempts/" + attemptId), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.student.fullName").value("Gelöschte:r Nutzer:in"));
        mvc.perform(auth(get("/api/instructor/courses/" + course[1] + "/enrollments"), teacher))
                .andExpect(status().isOk())
                .andExpect(content -> assertThat(content.getResponse().getContentAsString())
                        .contains("Gelöschte:r Nutzer:in").doesNotContain(email).doesNotContain("Ich heiße Lena"));

        // the address can be used for a new account
        register(email, "STUDENT", true);
    }

    @Test
    void instructorsWithCoursesAndTheLastAdminCannotDeleteTheirAccount() throws Exception {
        String[] course = courseWithQuiz();
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")), course[0])
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HAS_COURSES"))
                .andExpect(jsonPath("$.detail").value(containsString("1 Kurs")));

        // an instructor without courses may leave
        String teacher = approvedInstructor();
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")), teacher))
                .andExpect(status().isNoContent());

        String admin = admin();
        String adminId = me(admin);
        tx.executeWithoutResult(s -> users.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN && !u.getId().toString().equals(adminId))
                .forEach(u -> u.setEnabled(false)));
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")), admin))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_ADMIN"));
        admin(); // a second active admin
        mvc.perform(auth(jsonBody(delete("/api/users/me"), Map.of("password", PASSWORD, "confirm", "DELETE")), admin))
                .andExpect(status().isNoContent());
    }

    @Test
    void usersAreNeverHardDeleted() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> users.deleteById(id)).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> users.deleteAll()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> users.deleteAllInBatch()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void exportContainsAllPersonalDataAsZip() throws Exception {
        String[] course = courseWithQuiz();
        String email = uniqueEmail("export");
        String student = signUpWithTerms(email, "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + course[1] + "/enrollments"), Map.of()), student))
                .andExpect(status().isCreated());
        submitAttempt(student, course[2], "zwanzig-eins");
        upload(student, new MockMultipartFile("file", "Übung 1.txt", "text/plain", "Meine Lösung".getBytes(StandardCharsets.UTF_8)));

        MvcResult r = mvc.perform(auth(get("/api/users/me/export"), student))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/zip"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment; filename=\"sprachweg-data-")))
                .andReturn();
        Map<String, String> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(r.getResponse().getContentAsByteArray()))) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                entries.put(e.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        assertThat(entries).containsKeys("profile.json", "enrollments.json", "progress.json", "attempts.json",
                "notifications.json", "messages.json", "certificates.json", "files.json", "README.txt");
        assertThat(entries.get("profile.json")).contains(email).contains("termsAcceptedAt");
        assertThat(entries.get("enrollments.json")).contains("Deutsch A1 DSGVO");
        assertThat(entries.get("attempts.json")).contains("zwanzig-eins").contains("21 in Worten");
        assertThat(entries.keySet()).anyMatch(k -> k.startsWith("files/") && k.endsWith("Übung 1.txt"));
        assertThat(entries.entrySet().stream().filter(e -> e.getKey().startsWith("files/")).findFirst().orElseThrow()
                .getValue()).isEqualTo("Meine Lösung");

        // 3 exports per day
        mvc.perform(auth(get("/api/users/me/export"), student)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/users/me/export"), student)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/users/me/export"), student))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        mvc.perform(get("/api/users/me/export")).andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- headers & ShedLock

    @Test
    void apiResponsesCarrySecurityHeaders() throws Exception {
        mvc.perform(get("/api/public/courses"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")))
                .andExpect(header().doesNotExist("Strict-Transport-Security"));
        mvc.perform(get("/api/public/courses").secure(true))
                .andExpect(header().string("Strict-Transport-Security", containsString("max-age=31536000")));
    }

    @Test
    void shedLockAllowsOneHolderAtATime() {
        LockConfiguration config = new LockConfiguration(Instant.now(), "test-lock-" + UUID.randomUUID(),
                Duration.ofMinutes(1), Duration.ZERO);
        SimpleLock first = lockProvider.lock(config).orElseThrow();
        assertThat(lockProvider.lock(config)).isEmpty();
        first.unlock();
        assertThat(lockProvider.lock(config)).isPresent();
    }

    private static byte[] zip(String... names) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (String name : names) {
                zip.putNextEntry(new ZipEntry(name));
                zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
