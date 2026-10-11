package de.sprachweg.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** Instructor builds and publishes a course; students apply, get approved and learn only live content. */
class CourseLifecycleTest extends IntegrationTestSupport {

    private Map<String, Object> publication(String status, Instant publishAt, Instant unpublishAt) {
        Map<String, Object> m = new HashMap<>();
        m.put("publishStatus", status);
        m.put("publishAt", publishAt == null ? null : publishAt.toString());
        m.put("unpublishAt", unpublishAt == null ? null : unpublishAt.toString());
        return m;
    }

    private Map<String, Object> item(String type, String title, String body) {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("title", title);
        m.put("summary", "Kurz");
        m.put("body", body);
        m.put("durationMinutes", 10);
        m.put("attachmentIds", List.of());
        return m;
    }

    @Test
    void instructorFlowEnrollmentGatingAndQuiz() throws Exception {
        String teacher = signUp(uniqueEmail("anna"), "INSTRUCTOR");
        String otherTeacher = signUp(uniqueEmail("bernd"), "INSTRUCTOR");
        String student = signUp(uniqueEmail("luca"), "STUDENT");

        // ---- create course (starts as draft, slug from title) ----
        MvcResult created = mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                        "title", "Übungen für Anfänger", "subtitle", "A1", "description", "<p>Hallo<script>alert(1)</script></p>",
                        "level", "A1", "tags", List.of("Grammatik", " Grammatik ", "Alltag"),
                        "enrollmentMode", "APPROVAL", "capacity", 1)), teacher))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value(org.hamcrest.Matchers.startsWith("uebungen-fuer-anfaenger")))
                .andExpect(jsonPath("$.visibility").value("DRAFT"))
                .andExpect(jsonPath("$.description").value("<p>Hallo</p>"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andReturn();
        String courseId = read(created, "$.id");
        String slug = read(created, "$.slug");

        // other instructors cannot see it
        mvc.perform(auth(get("/api/instructor/courses/" + courseId), otherTeacher)).andExpect(status().isNotFound());

        // ---- module + items ----
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 1", "description", "Start")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        String module2Id = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 2")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        String textId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"),
                item("TEXT", "Begrüßungen", "<p>Guten Tag!</p><img src=x onerror=alert(1)>")), teacher))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("DRAFT"))
                .andExpect(jsonPath("$.body").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("onerror"))))
                .andReturn(), "$.id");
        String scheduledId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"),
                item("TEXT", "Zahlen", "<p>eins, zwei</p>")), teacher)).andReturn(), "$.id");
        String quizId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + module2Id + "/items"),
                item("QUIZ", "Quiz", "<p>Los geht's</p>")), teacher))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assessment.questionCount").value(0))
                .andReturn(), "$.id");
        // EMBED requires an URL
        mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"),
                        item("EMBED", "Link", "")), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.externalUrl").exists());

        // move the quiz into module 1 as the first item, then back
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/items/order"),
                Map.of("ids", List.of(quizId, textId, scheduledId))), teacher)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/instructor/courses/" + courseId), teacher))
                .andExpect(jsonPath("$.modules[0].items[0].id").value(quizId))
                .andExpect(jsonPath("$.modules[1].items.length()").value(0));
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + module2Id + "/items/order"),
                Map.of("ids", List.of(quizId))), teacher)).andExpect(status().isNoContent());
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/modules/order"),
                Map.of("ids", List.of(module2Id, moduleId))), teacher)).andExpect(status().isNoContent());
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/modules/order"),
                Map.of("ids", List.of(moduleId, module2Id))), teacher)).andExpect(status().isNoContent());

        // ---- assessment ----
        Map<String, Object> quiz = Map.of(
                "instructions", "Viel Erfolg", "maxAttempts", 2, "passingScore", 50, "showCorrectAnswers", true,
                "questions", List.of(
                        Map.of("type", "SINGLE_CHOICE", "prompt", "Guten …?", "points", 1, "options", List.of(
                                Map.of("text", "Morgen", "correct", true), Map.of("text", "Nacht", "correct", false))),
                        Map.of("type", "MULTIPLE_CHOICE", "prompt", "Feminin?", "points", 2, "options", List.of(
                                Map.of("text", "Lampe", "correct", true), Map.of("text", "Tisch", "correct", false),
                                Map.of("text", "Frau", "correct", true))),
                        Map.of("type", "TRUE_FALSE", "prompt", "Das Mädchen ist neutral.", "points", 1, "options", List.of(
                                Map.of("text", "Richtig", "correct", true), Map.of("text", "Falsch", "correct", false))),
                        Map.of("type", "SHORT_ANSWER", "prompt", "21 in Worten", "points", 1,
                                "acceptedAnswers", List.of("einundzwanzig")),
                        Map.of("type", "FILL_BLANK", "prompt", "Ich ___ Luca.", "points", 1, "acceptedAnswers", List.of("bin")),
                        Map.of("type", "ESSAY", "prompt", "Stell dich vor.", "points", 4)));
        MvcResult saved = mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), quiz), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(6))
                .andExpect(jsonPath("$.questions[1].options.length()").value(3))
                .andReturn();
        // id-based update: keep q0 (rename), drop the rest except the essay
        String q0 = read(saved, "$.questions[0].id");
        String q0opt = read(saved, "$.questions[0].options[0].id");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), Map.of(
                        "questions", List.of(Map.of("type", "SINGLE_CHOICE", "prompt", "x", "options", List.of(
                                Map.of("text", "only one", "correct", true)))))), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['questions[0].options']").exists());
        saved = mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), quiz), teacher))
                .andExpect(status().isOk()).andReturn();
        assertThat((String) read(saved, "$.questions[0].id")).isNotEqualTo(q0); // re-created without ids
        q0 = read(saved, "$.questions[0].id");
        q0opt = read(saved, "$.questions[0].options[0].id");

        // ---- publish course + module 1 + text item; schedule the second item; module 2 with quiz ----
        Instant inThreeDays = Instant.now().plus(Duration.ofDays(3));
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"),
                        publication("PUBLISHED", Instant.now().plusSeconds(3600), Instant.now())), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.unpublishAt").exists());
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"),
                        publication("PUBLISHED", null, null)), teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$.visibility").value("LIVE"));
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/publication"),
                        publication("PUBLISHED", null, null)), teacher))
                .andExpect(jsonPath("$.visibility").value("LIVE"));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + textId + "/publication"),
                        publication("PUBLISHED", null, null)), teacher))
                .andExpect(jsonPath("$.visibility").value("LIVE"));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + scheduledId + "/publication"),
                        publication("PUBLISHED", inThreeDays, null)), teacher))
                .andExpect(jsonPath("$.visibility").value("SCHEDULED"));
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + module2Id + "/publication"),
                publication("PUBLISHED", null, null)), teacher)).andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/publication"),
                publication("PUBLISHED", null, null)), teacher)).andExpect(status().isOk());

        // schedule shows the scheduled item
        mvc.perform(auth(get("/api/instructor/schedule").param("courseId", courseId), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].entityType").value("ITEM"))
                .andExpect(jsonPath("$[0].action").value("PUBLISH"))
                .andExpect(jsonPath("$[0].entityId").value(scheduledId));

        // public catalog shows only live outline
        mvc.perform(get("/api/public/courses/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outline[0].items.length()").value(1))
                .andExpect(jsonPath("$.itemCount").value(2));
        mvc.perform(get("/api/public/courses").param("q", "anfänger"))
                .andExpect(jsonPath("$.content[?(@.id=='" + courseId + "')]").exists());

        // ---- gating: not enrolled ----
        mvc.perform(auth(get("/api/student/items/" + textId), student))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/learn"), student)).andExpect(status().isForbidden());

        // apply → pending; instructor cannot apply to own course
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"), Map.of("message", "Hallo!")), teacher))
                .andExpect(status().isBadRequest());
        MvcResult applied = mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"),
                        Map.of("message", "Hallo!")), student))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.waitlistPosition").value(1))
                .andReturn();
        String enrollmentId = read(applied, "$.id");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"), Map.of()), student))
                .andExpect(status().isConflict());
        mvc.perform(auth(get("/api/student/items/" + textId), student)).andExpect(status().isForbidden());

        // a second student applies → waitlist position 2
        String student2 = signUp(uniqueEmail("sofia"), "STUDENT");
        String enrollment2 = read(mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"),
                Map.of()), student2)).andExpect(jsonPath("$.waitlistPosition").value(2)).andReturn(), "$.id");
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/enrollments").param("status", "PENDING"), teacher))
                .andExpect(jsonPath("$[0].id").value(enrollmentId))
                .andExpect(jsonPath("$[1].waitlistPosition").value(2));

        // approve; capacity 1 → second approval conflicts
        mvc.perform(auth(post("/api/instructor/enrollments/" + enrollmentId + "/approve"), otherTeacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/instructor/enrollments/" + enrollmentId + "/approve"), teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        mvc.perform(auth(post("/api/instructor/enrollments/" + enrollment2 + "/approve"), teacher))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CAPACITY_REACHED"));
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"),
                        Map.of("ids", List.of(enrollment2), "action", "REJECT", "reason", "Kurs ist voll")), teacher))
                .andExpect(jsonPath("$[0].status").value("REJECTED"))
                .andExpect(jsonPath("$[0].decisionReason").value("Kurs ist voll"));

        // student got a notification
        mvc.perform(auth(get("/api/notifications/unread-count"), student)).andExpect(jsonPath("$.count").value(1));
        mvc.perform(auth(get("/api/notifications"), student))
                .andExpect(jsonPath("$.content[0].type").value("ENROLLMENT_APPROVED"))
                .andExpect(jsonPath("$.totalElements").value(1));

        // ---- approved: live content visible, draft/scheduled not ----
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/learn"), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modules[0].items.length()").value(1))
                .andExpect(jsonPath("$.modules[1].items[0].id").value(quizId))
                .andExpect(jsonPath("$.progressPercent").value(0));
        mvc.perform(auth(get("/api/student/items/" + textId), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prevItemId").doesNotExist())
                .andExpect(jsonPath("$.nextItemId").value(quizId));
        mvc.perform(auth(get("/api/student/items/" + scheduledId), student)).andExpect(status().isNotFound());

        // draft item becomes visible after publishing
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + scheduledId + "/publication"),
                publication("PUBLISHED", Instant.now().minusSeconds(60), null)), teacher))
                .andExpect(jsonPath("$.visibility").value("LIVE"));
        mvc.perform(auth(get("/api/student/items/" + scheduledId), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prevItemId").value(textId))
                .andExpect(jsonPath("$.nextItemId").value(quizId));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + scheduledId + "/publication"),
                publication("DRAFT", null, null)), teacher));
        mvc.perform(auth(get("/api/student/items/" + scheduledId), student)).andExpect(status().isNotFound());

        // progress
        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), student)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/learn"), student))
                .andExpect(jsonPath("$.progressPercent").value(50))
                .andExpect(jsonPath("$.modules[0].items[0].completed").value(true));
        mvc.perform(auth(get("/api/student/enrollments"), student))
                .andExpect(jsonPath("$[0].progressPercent").value(50))
                .andExpect(jsonPath("$[0].course.id").value(courseId));

        // ---- quiz attempt with auto-grading ----
        MvcResult session = mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.questions.length()").value(6))
                .andExpect(jsonPath("$.questions[0].options[0].correct").doesNotExist())
                .andReturn();
        String attemptId = read(session, "$.id");
        // resuming returns the same attempt
        mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(jsonPath("$.id").value(attemptId));

        List<String> qIds = read(session, "$.questions[*].id");
        Map<String, Object> qs = new HashMap<>();
        List<Map<String, Object>> sessionQuestions = read(session, "$.questions");
        for (Map<String, Object> q : sessionQuestions) {
            qs.put((String) q.get("prompt"), q);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> single = (Map<String, Object>) qs.get("Guten …?");
        @SuppressWarnings("unchecked")
        Map<String, Object> multi = (Map<String, Object>) qs.get("Feminin?");
        @SuppressWarnings("unchecked")
        Map<String, Object> tf = (Map<String, Object>) qs.get("Das Mädchen ist neutral.");
        @SuppressWarnings("unchecked")
        Map<String, Object> shortQ = (Map<String, Object>) qs.get("21 in Worten");
        @SuppressWarnings("unchecked")
        Map<String, Object> blank = (Map<String, Object>) qs.get("Ich ___ Luca.");
        @SuppressWarnings("unchecked")
        Map<String, Object> essay = (Map<String, Object>) qs.get("Stell dich vor.");
        assertThat(qIds).hasSize(6);

        List<Map<String, Object>> multiOpts = opts(multi);
        List<Map<String, Object>> answers = List.of(
                Map.of("questionId", single.get("id"), "selectedOptionIds", List.of(opts(single).get(0).get("id"))),
                // multiple choice: only one of two correct options → all-or-nothing → wrong
                Map.of("questionId", multi.get("id"), "selectedOptionIds", List.of(multiOpts.get(0).get("id"))),
                Map.of("questionId", tf.get("id"), "selectedOptionIds", List.of(opts(tf).get(0).get("id"))),
                Map.of("questionId", shortQ.get("id"), "textAnswer", "  Einundzwanzig "),
                Map.of("questionId", blank.get("id"), "textAnswer", "BIN"),
                Map.of("questionId", essay.get("id"), "textAnswer", "Ich heiße Luca und komme aus Mailand."));
        MvcResult result = mvc.perform(auth(jsonBody(post("/api/student/attempts/" + attemptId + "/submit"),
                        Map.of("answers", answers)), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.pendingManualGrading").value(true))
                .andExpect(jsonPath("$.score").value(4.0))
                .andExpect(jsonPath("$.maxScore").value(10.0))
                .andExpect(jsonPath("$.passed").doesNotExist())
                .andReturn();
        List<Boolean> correctFlags = read(result, "$.answers[*].correct");
        assertThat(correctFlags.stream().filter(Boolean.TRUE::equals).count()).isEqualTo(4);
        mvc.perform(auth(post("/api/student/attempts/" + attemptId + "/submit"), student)
                        .contentType("application/json").content("{\"answers\":[]}"))
                .andExpect(status().isConflict());

        // instructor grades the essay → GRADED, student notified
        mvc.perform(auth(get("/api/instructor/items/" + quizId + "/attempts"), teacher))
                .andExpect(jsonPath("$[0].pendingManualGrading").value(true));
        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + attemptId + "/grade"),
                        Map.of("grades", List.of(Map.of("questionId", essay.get("id"), "pointsAwarded", 5)))), teacher))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + attemptId + "/grade"), Map.of("grades", List.of(
                        Map.of("questionId", essay.get("id"), "pointsAwarded", 3, "feedback", "Gut gemacht!")))), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRADED"))
                .andExpect(jsonPath("$.score").value(7.0))
                .andExpect(jsonPath("$.percent").value(70.0))
                .andExpect(jsonPath("$.passed").value(true));
        mvc.perform(auth(get("/api/student/attempts/" + attemptId), student))
                .andExpect(jsonPath("$.status").value("GRADED"))
                .andExpect(jsonPath("$.answers[?(@.type=='ESSAY')].feedback").value(org.hamcrest.Matchers.hasItem("Gut gemacht!")));
        mvc.perform(auth(get("/api/student/items/" + quizId), student))
                .andExpect(jsonPath("$.assessment.attemptsUsed").value(1))
                .andExpect(jsonPath("$.assessment.bestPercent").value(70.0))
                .andExpect(jsonPath("$.assessment.questionCount").value(6));

        // editing the quiz later does not break the old attempt (snapshot)
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), Map.of("maxAttempts", 2,
                "questions", List.of(Map.of("id", q0, "type", "SINGLE_CHOICE", "prompt", "Neu?", "options", List.of(
                        Map.of("id", q0opt, "text", "A", "correct", true), Map.of("text", "B", "correct", false)))))), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].id").value(q0))
                .andExpect(jsonPath("$.questions[0].options[0].id").value(q0opt));
        mvc.perform(auth(get("/api/student/attempts/" + attemptId), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(6));

        // second attempt allowed, third not (maxAttempts 2)
        String second = read(mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(status().isOk()).andReturn(), "$.id");
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + second + "/submit"), Map.of("answers", List.of())), student))
                .andExpect(jsonPath("$.status").value("GRADED"))
                .andExpect(jsonPath("$.score").value(0.0));
        mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MAX_ATTEMPTS_REACHED"));

        // ---- revoke removes access ----
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/" + enrollmentId + "/revoke"),
                Map.of("reason", "Test")), teacher)).andExpect(jsonPath("$.status").value("REVOKED"));
        mvc.perform(auth(get("/api/student/items/" + textId), student)).andExpect(status().isForbidden());
        // re-apply reuses the row
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"), Map.of()), student))
                .andExpect(jsonPath("$.id").value(enrollmentId))
                .andExpect(jsonPath("$.status").value("PENDING"));

        // ---- dashboard, unpublish course, delete ----
        mvc.perform(auth(get("/api/instructor/dashboard"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courseCount").value(1))
                .andExpect(jsonPath("$.pendingCount").value(1));
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"),
                publication("PUBLISHED", null, Instant.now().minusSeconds(1))), teacher))
                .andExpect(jsonPath("$.visibility").value("EXPIRED"));
        mvc.perform(get("/api/public/courses/" + slug)).andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/instructor/items/" + quizId), teacher)).andExpect(status().isNoContent());
        mvc.perform(auth(delete("/api/instructor/courses/" + courseId), teacher)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/instructor/courses/" + courseId), teacher)).andExpect(status().isNotFound());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> opts(Map<String, Object> q) {
        return (List<Map<String, Object>>) q.get("options");
    }
}
