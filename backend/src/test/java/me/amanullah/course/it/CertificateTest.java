package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Course completion certificates: criteria evaluation, automatic issuing (also after manual grading, idempotent),
 * manual issue and revocation, PDF download, public verification, ownership and bad input.
 */
class CertificateTest extends IntegrationTestSupport {

    private static final String CODE = "SW-\\d{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}";

    private String teacher;
    private String otherTeacher;
    private String luca;
    private String sofia;
    private String outsider;
    private String lucaId;
    private String sofiaId;
    private String outsiderId;
    private String courseId;
    private String textId;
    private String quizId;
    private String examId;

    private String register(String name, String role) throws Exception {
        String email = uniqueEmail(role.toLowerCase());
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", name, "email", email, "password", PASSWORD, "role", role)))
                .andExpect(status().isCreated());
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email))))
                .andExpect(status().isOk());
        return login(email);
    }

    private String me(String token) throws Exception {
        return read(mvc.perform(auth(get("/api/users/me"), token)).andReturn(), "$.id");
    }

    private void publish(String base) throws Exception {
        mvc.perform(auth(jsonBody(put(base + "/publication"), Map.of("publishStatus", "PUBLISHED")), teacher))
                .andExpect(status().isOk());
    }

    private String item(String moduleId, String type, String title) throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("title", title);
        m.put("body", "<p>x</p>");
        m.put("attachmentIds", List.of());
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"), m), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish("/api/instructor/items/" + id);
        return id;
    }

    /** Starts an attempt and answers every choice question with the given option text and text questions with text. */
    @SuppressWarnings("unchecked")
    private String attempt(String student, String itemId, String option, String text) throws Exception {
        MvcResult session = mvc.perform(auth(post("/api/student/items/" + itemId + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
        String id = read(session, "$.id");
        List<Map<String, Object>> questions = read(session, "$.questions");
        List<Map<String, Object>> answers = new ArrayList<>();
        for (Map<String, Object> q : questions) {
            if ("ESSAY".equals(q.get("type"))) {
                answers.add(Map.of("questionId", q.get("id"), "textAnswer", text));
            } else {
                List<Object> ids = ((List<Map<String, Object>>) q.get("options")).stream()
                        .filter(o -> option.equals(o.get("text"))).map(o -> o.get("id")).toList();
                answers.add(Map.of("questionId", q.get("id"), "selectedOptionIds", ids));
            }
        }
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + id + "/submit"), Map.of("answers", answers)), student))
                .andExpect(status().isOk());
        return id;
    }

    private void gradeEssay(String attemptId, int points) throws Exception {
        String essayId = read(mvc.perform(auth(get("/api/instructor/attempts/" + attemptId), teacher))
                .andReturn(), "$.answers[1].questionId");
        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + attemptId + "/grade"),
                Map.of("grades", List.of(Map.of("questionId", essayId, "pointsAwarded", points, "feedback", "Gut")))),
                teacher)).andExpect(status().isOk());
    }

    private Map<String, Object> settings(boolean enabled, int minProgress, boolean assessments, Integer minScore) {
        Map<String, Object> s = new HashMap<>();
        s.put("enabled", enabled);
        s.put("minProgressPercent", minProgress);
        s.put("requireAssessmentsPassed", assessments);
        s.put("minAverageScore", minScore);
        s.put("showScore", true);
        s.put("signerName", "Anna Schneider");
        s.put("organization", "Sprachschule Müller");
        s.put("customText", "Mit Ausdauer gelernt.");
        s.put("language", "LEARNER");
        return s;
    }

    private void saveSettings(Map<String, Object> s) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/certificate-settings"), s), teacher))
                .andExpect(status().isOk());
    }

    private String statusUrl() {
        return "/api/student/courses/" + courseId + "/certificate";
    }

    private int certificateCount(String student) throws Exception {
        List<?> list = read(mvc.perform(auth(get("/api/student/certificates"), student))
                .andExpect(status().isOk()).andReturn(), "$");
        return list.size();
    }

    private String issueManually(String studentId) throws Exception {
        return read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/certificates/issue"),
                Map.of("studentId", studentId)), teacher)).andExpect(status().isOk()).andReturn(), "$.id");
    }

    private static String pdfText(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
            return new PDFTextStripper().getText(doc);
        }
    }

    @BeforeEach
    void seed() throws Exception {
        teacher = register("Anna Schneider", "INSTRUCTOR");
        otherTeacher = register("Bernd Fremd", "INSTRUCTOR");
        luca = register("Luca Rossi", "STUDENT");
        sofia = register("Sofia Größer", "STUDENT");
        outsider = register("Olga Außen", "STUDENT");
        lucaId = me(luca);
        sofiaId = me(sofia);
        outsiderId = me(outsider);

        courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Deutsch A1: Erste Schritte", "level", "A1", "tags", List.of(), "enrollmentMode", "APPROVAL")),
                teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        publish("/api/instructor/courses/" + courseId);
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 1")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        publish("/api/instructor/modules/" + moduleId);
        textId = item(moduleId, "TEXT", "Begrüßung");
        quizId = item(moduleId, "QUIZ", "Quiz 1");
        examId = item(moduleId, "EXAM", "Abschlussprüfung");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), Map.of(
                "passingScore", 60, "questions", List.of(Map.of("type", "SINGLE_CHOICE", "prompt", "Hallo?", "points", 2,
                        "options", List.of(Map.of("text", "Ja", "correct", true),
                                Map.of("text", "Nein", "correct", false)))))), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + examId + "/assessment"), Map.of(
                "passingScore", 50, "questions", List.of(
                        Map.of("type", "SINGLE_CHOICE", "prompt", "Ja?", "points", 1,
                                "options", List.of(Map.of("text", "Ja", "correct", true),
                                        Map.of("text", "Nein", "correct", false))),
                        Map.of("type", "ESSAY", "prompt", "Stell dich vor.", "points", 4)))), teacher))
                .andExpect(status().isOk());
        for (String s : List.of(luca, sofia)) {
            String e = read(mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"),
                    Map.of()), s)).andExpect(status().isCreated()).andReturn(), "$.id");
            mvc.perform(auth(post("/api/instructor/enrollments/" + e + "/approve"), teacher)).andExpect(status().isOk());
        }
    }

    @Test
    void criteriaChecklistAndAutomaticIssueAfterGradingIsIdempotent() throws Exception {
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_ENABLED"))
                .andExpect(jsonPath("$.certificate").doesNotExist());
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificate-settings"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.minProgressPercent").value(100))
                .andExpect(jsonPath("$.requireAssessmentsPassed").value(true))
                .andExpect(jsonPath("$.courseLevel").value("A1"))
                .andExpect(jsonPath("$.defaultSignerName").value("Anna Schneider"))
                .andExpect(jsonPath("$.language").value("LEARNER"));

        saveSettings(settings(true, 100, true, null));
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.criteriaMet").value(false))
                .andExpect(jsonPath("$.criteria[0].key").value("PROGRESS"))
                .andExpect(jsonPath("$.criteria[0].current").value(0.0))
                .andExpect(jsonPath("$.criteria[0].target").value(100.0))
                .andExpect(jsonPath("$.criteria[1].key").value("ASSESSMENTS_PASSED"))
                .andExpect(jsonPath("$.criteria[1].current").value(0.0))
                .andExpect(jsonPath("$.criteria[1].target").value(2.0))
                .andExpect(jsonPath("$.criteria", hasSize(2)));

        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), luca)).andExpect(status().isNoContent());
        attempt(luca, quizId, "Ja", null);
        String exam = attempt(luca, examId, "Ja", "Ich heiße Luca.");
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.criteria[0].current").value(100.0))
                .andExpect(jsonPath("$.criteria[0].met").value(true))
                .andExpect(jsonPath("$.criteria[1].current").value(1.0))
                .andExpect(jsonPath("$.criteria[1].pending").value(1))
                .andExpect(jsonPath("$.criteria[1].met").value(false));
        assertThat(certificateCount(luca)).isZero();

        // Grading the essay completes the criteria: the certificate is issued right away (after commit).
        gradeEssay(exam, 4);
        assertThat(certificateCount(luca)).isEqualTo(1);
        mvc.perform(auth(get("/api/student/certificates"), luca))
                .andExpect(jsonPath("$[0].code", matchesPattern(CODE)))
                .andExpect(jsonPath("$[0].learnerName").value("Luca Rossi"))
                .andExpect(jsonPath("$[0].courseTitle").value("Deutsch A1: Erste Schritte"))
                .andExpect(jsonPath("$[0].level").value("A1"))
                .andExpect(jsonPath("$[0].finalScore").value(100.0))
                .andExpect(jsonPath("$[0].instructorName").value("Anna Schneider"))
                .andExpect(jsonPath("$[0].organization").value("Sprachschule Müller"))
                .andExpect(jsonPath("$[0].issueType").value("AUTOMATIC"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].verificationUrl", containsString("/certificates/verify/SW-")));
        mvc.perform(auth(get("/api/notifications"), luca))
                .andExpect(jsonPath("$.content[0].type").value("CERTIFICATE_ISSUED"))
                .andExpect(jsonPath("$.content[0].link").value("/learn/" + courseId + "/certificate"));
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.certificate.code", matchesPattern(CODE)));

        // Idempotent: more progress events, status reads and settings saves never create a second certificate.
        mvc.perform(auth(delete("/api/student/items/" + textId + "/complete"), luca)).andExpect(status().isNoContent());
        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), luca)).andExpect(status().isNoContent());
        attempt(luca, quizId, "Ja", null);
        saveSettings(settings(true, 100, true, null));
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(jsonPath("$.status").value("ISSUED"));
        assertThat(certificateCount(luca)).isEqualTo(1);
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificates"), teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].student.id").value(lucaId));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificate-settings"), teacher))
                .andExpect(jsonPath("$.issuedCount").value(1));
    }

    @Test
    void progressThresholdAndMinimumAverageScore() throws Exception {
        saveSettings(settings(true, 50, false, 80));
        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), sofia)).andExpect(status().isNoContent());
        mvc.perform(auth(get(statusUrl()), sofia))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.criteria[0].current").value(33.0))
                .andExpect(jsonPath("$.criteria[0].met").value(false))
                .andExpect(jsonPath("$.criteria[1].key").value("AVERAGE_SCORE"))
                .andExpect(jsonPath("$.criteria[1].current").doesNotExist())
                .andExpect(jsonPath("$.criteria[1].met").value(false));

        attempt(sofia, quizId, "Nein", null); // 0 % → progress 67 % ≥ 50 %, but average 0 % < 80 %
        mvc.perform(auth(get(statusUrl()), sofia))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.criteria[0].met").value(true))
                .andExpect(jsonPath("$.criteria[1].current").value(0.0))
                .andExpect(jsonPath("$.criteria[1].met").value(false));
        attempt(sofia, quizId, "Ja", null); // best attempt 100 % → average 100 % → issued by the attempt trigger
        assertThat(certificateCount(sofia)).isEqualTo(1);
        mvc.perform(auth(get("/api/student/certificates"), sofia)).andExpect(jsonPath("$[0].finalScore").value(100.0));

        // Lowering the threshold issues certificates for learners who already qualify when the settings are saved.
        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), luca)).andExpect(status().isNoContent());
        assertThat(certificateCount(luca)).isZero();
        saveSettings(settings(true, 30, false, null));
        assertThat(certificateCount(luca)).isEqualTo(1);
        mvc.perform(auth(get("/api/student/certificates"), luca)).andExpect(jsonPath("$[0].finalScore").doesNotExist());

        // Disabled: nothing is issued automatically, the status says so.
        saveSettings(settings(false, 0, false, null));
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/certificate"), outsider))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
    }

    @Test
    void manualIssueRevokeAndReissue() throws Exception {
        String id = issueManually(lucaId);
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/certificates/issue"),
                Map.of("studentId", lucaId)), teacher))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CERTIFICATE_EXISTS"));
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/certificates/issue"),
                Map.of("studentId", outsiderId)), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ENROLLMENT_NOT_FOUND"));
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/certificates/issue"),
                Map.of("studentId", UUID.randomUUID())), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));

        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificates"), teacher))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].issueType").value("MANUAL"))
                .andExpect(jsonPath("$[0].issuedByName").value("Anna Schneider"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificates").param("q", "rossi"), teacher))
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificates").param("q", "zzz"), teacher))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.certificate.issueType").value("MANUAL"));

        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"), Map.of("reason", " ")), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.reason").exists());
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"),
                Map.of("reason", "Issued by mistake")), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVOKED"))
                .andExpect(jsonPath("$.revokedReason").value("Issued by mistake"));
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"), Map.of("reason", "again")),
                teacher)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CERTIFICATE_REVOKED"));

        mvc.perform(auth(get(statusUrl()), luca)).andExpect(jsonPath("$.status").value("REVOKED"))
                .andExpect(jsonPath("$.certificate.revokedReason").value("Issued by mistake"));
        mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf"), luca))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CERTIFICATE_REVOKED"));
        byte[] stamped = mvc.perform(auth(get("/api/instructor/certificates/" + id + "/pdf"), teacher))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(pdfText(stamped).replace(" ", "")).contains("REVOKED");
        mvc.perform(auth(get("/api/notifications"), luca))
                .andExpect(jsonPath("$.content[0].type").value("CERTIFICATE_REVOKED"));

        // A revoked certificate is never re-issued automatically, only manually (new code).
        saveSettings(settings(true, 0, false, null));
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(jsonPath("$.status").value("REVOKED"));
        String again = issueManually(lucaId);
        assertThat(again).isNotEqualTo(id);
        mvc.perform(auth(get(statusUrl()), luca)).andExpect(jsonPath("$.status").value("ISSUED"));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/certificates").param("q", "Luca"), teacher))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[1].status").value("REVOKED"));
        // Sofia met the (relaxed) criteria when the settings were saved
        assertThat(certificateCount(sofia)).isEqualTo(1);
    }

    @Test
    void pdfDownloadIsAValidLocalizedPdf() throws Exception {
        saveSettings(settings(false, 100, true, null));
        String id = issueManually(lucaId);
        String code = read(mvc.perform(auth(get("/api/student/certificates"), luca)).andReturn(), "$[0].code");
        MvcResult r = mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf"), luca)
                        .accept(MediaType.APPLICATION_PDF, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        containsString("Certificate-Deutsch-A1-Luca-Rossi.pdf")))
                .andReturn();
        byte[] pdf = r.getResponse().getContentAsByteArray();
        assertThat(pdf.length).isGreaterThan(1000);
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
        String text = pdfText(pdf);
        assertThat(text).contains("Luca Rossi", "Deutsch A1: Erste Schritte", "Certificate of Completion", code,
                "SPRACHSCHULE MÜLLER", "Mit Ausdauer gelernt.");

        byte[] german = mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf").param("lang", "de"), luca))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        containsString("Zertifikat-Deutsch-A1-Luca-Rossi.pdf")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(pdfText(german)).contains("Teilnahmebestätigung", "Luca Rossi", "Niveau A1");

        // The instructor may download every certificate of their course.
        mvc.perform(auth(get("/api/instructor/certificates/" + id + "/pdf"), teacher))
                .andExpect(status().isOk()).andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void publicVerificationValidRevokedAndUnknownWithoutEmail() throws Exception {
        String id = issueManually(sofiaId);
        String code = read(mvc.perform(auth(get("/api/student/certificates"), sofia)).andReturn(), "$[0].code");
        String body = mvc.perform(get("/api/public/certificates/" + code.toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.revoked").value(false))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.learnerName").value("Sofia Größer"))
                .andExpect(jsonPath("$.courseTitle").value("Deutsch A1: Erste Schritte"))
                .andExpect(jsonPath("$.level").value("A1"))
                .andExpect(jsonPath("$.instructorName").value("Anna Schneider"))
                .andExpect(jsonPath("$.issuedAt").exists())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("@").doesNotContain("email").doesNotContain(sofiaId).doesNotContain(id);
        // a stale access token is ignored on public endpoints
        mvc.perform(get("/api/public/certificates/" + code).header(HttpHeaders.AUTHORIZATION, "Bearer x.y.z"))
                .andExpect(status().isOk());

        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"), Map.of("reason", "Betrug")),
                teacher)).andExpect(status().isOk());
        mvc.perform(get("/api/public/certificates/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.revoked").value(true))
                .andExpect(jsonPath("$.revokedAt").exists())
                .andExpect(content().string(not(containsString("Betrug"))));

        mvc.perform(get("/api/public/certificates/SW-2026-AAAA-BBBB-CCCC"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
        for (String bad : List.of("x", "SW-2026", "SW-2026-IIII-OOOO-LLLL", "a".repeat(300))) {
            mvc.perform(get("/api/public/certificates/" + bad))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
        }
        mvc.perform(get("/api/public/certificates/{code}", "' or 1=1 --")).andExpect(status().is4xxClientError());
    }

    @Test
    void ownershipOtherLearnersAndInstructorsGet404() throws Exception {
        String id = issueManually(lucaId);
        String base = "/api/instructor/courses/" + courseId;
        mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf"), sofia))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
        mvc.perform(auth(get("/api/student/certificates"), sofia)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf"), teacher))
                .andExpect(status().isNotFound());

        mvc.perform(auth(get(base + "/certificate-settings"), otherTeacher)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), settings(true, 100, true, null)), otherTeacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get(base + "/certificates"), otherTeacher)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post(base + "/certificates/issue"), Map.of("studentId", lucaId)), otherTeacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"), Map.of("reason", "x")),
                otherTeacher)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
        mvc.perform(auth(get("/api/instructor/certificates/" + id + "/pdf"), otherTeacher))
                .andExpect(status().isNotFound());

        mvc.perform(auth(get(base + "/certificate-settings"), luca)).andExpect(status().isForbidden());
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"), Map.of("reason", "x")), luca))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/student/certificates")).andExpect(status().isUnauthorized());
        mvc.perform(get(statusUrl())).andExpect(status().isUnauthorized());

        // the course owner previewing the player sees the status but never gets a certificate
        mvc.perform(auth(get(statusUrl()), teacher)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_ENABLED"));
    }

    @Test
    void badInputIsAlways4xx() throws Exception {
        String base = "/api/instructor/courses/" + courseId;
        Map<String, Object> s = settings(true, 150, true, null);
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.minProgressPercent").exists());
        s = settings(true, 100, true, -1);
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.minAverageScore").exists());
        s = settings(true, 100, true, null);
        s.put("language", "FR");
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        s = settings(true, 100, true, null);
        s.put("level", "Z9");
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest());
        s = settings(true, 100, true, null);
        s.put("customText", "x".repeat(401));
        s.put("title", "y".repeat(81));
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.customText").exists()).andExpect(jsonPath("$.errors.title").exists());
        s = settings(true, 100, true, null);
        s.put("signatureImageId", UUID.randomUUID().toString());
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.signatureImageId").exists());
        String textMedia = read(mvc.perform(multipart("/api/media")
                .file(new MockMultipartFile("file", "notes.txt", "text/plain", "hi".getBytes()))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        s.put("signatureImageId", textMedia);
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.signatureImageId").exists());
        String foreignImage = read(mvc.perform(multipart("/api/media")
                .file(new MockMultipartFile("file", "sig.png", "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'}))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherTeacher)).andExpect(status().isCreated()).andReturn(),
                "$.id");
        s.put("signatureImageId", foreignImage);
        mvc.perform(auth(jsonBody(put(base + "/certificate-settings"), s), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.signatureImageId").exists());
        mvc.perform(auth(put(base + "/certificate-settings").contentType(MediaType.APPLICATION_JSON).content("{"), teacher))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(put(base + "/certificate-settings"), teacher)).andExpect(status().is4xxClientError());

        mvc.perform(auth(get("/api/instructor/courses/not-a-uuid/certificate-settings"), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(auth(get("/api/instructor/courses/" + UUID.randomUUID() + "/certificates"), teacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post(base + "/certificates/issue"), Map.of()), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.studentId").exists());
        mvc.perform(auth(jsonBody(post(base + "/certificates/issue"), Map.of("studentId", "nope")), teacher))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + UUID.randomUUID() + "/revoke"),
                Map.of("reason", "x")), teacher)).andExpect(status().isNotFound());
        String id = issueManually(lucaId);
        mvc.perform(auth(jsonBody(post("/api/instructor/certificates/" + id + "/revoke"),
                Map.of("reason", "x".repeat(501))), teacher)).andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/student/certificates/" + UUID.randomUUID() + "/pdf"), luca))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get("/api/student/certificates/nope/pdf"), luca)).andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/student/certificates/" + id + "/pdf").param("lang", "xx"), luca))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/courses/" + UUID.randomUUID() + "/certificate"), luca))
                .andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/student/certificates"), luca)).andExpect(status().isMethodNotAllowed());
    }
}
