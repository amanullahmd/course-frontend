package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assessment.AttemptExpirySweeper;
import me.amanullah.course.assessment.AttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** Server-side autosave, expiry finalization (lazy, on submit, sweeper) and schedule window events. */
class ExamTimingTest extends IntegrationTestSupport {

    @Autowired
    private AttemptRepository attemptRepo;

    @Autowired
    private AssessmentRepository assessmentRepo;

    @Autowired
    private AttemptExpirySweeper sweeper;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private record Exam(String teacher, String courseId, String itemId) {
    }

    private record Session(String id, String choiceQ, String rightOpt, String wrongOpt, String essayQ) {
    }

    private Map<String, Object> publication() {
        Map<String, Object> m = new HashMap<>();
        m.put("publishStatus", "PUBLISHED");
        m.put("publishAt", null);
        m.put("unpublishAt", null);
        return m;
    }

    /** Course + module + exam (single choice + essay), everything published. */
    private Exam exam(Integer timeLimit, int maxAttempts, Instant from, Instant until) throws Exception {
        String teacher = signUp(uniqueEmail("exam-teacher"), "INSTRUCTOR");
        String courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Prüfungskurs", "level", "B1", "enrollmentMode", "OPEN")), teacher)).andReturn(), "$.id");
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "M")), teacher)).andReturn(), "$.id");
        String itemId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"),
                Map.of("type", "EXAM", "title", "Abschlussprüfung")), teacher)).andExpect(status().isCreated())
                .andReturn(), "$.id");
        Map<String, Object> assessment = new HashMap<>();
        assessment.put("timeLimitMinutes", timeLimit);
        assessment.put("maxAttempts", maxAttempts);
        assessment.put("availableFrom", from == null ? null : from.toString());
        assessment.put("availableUntil", until == null ? null : until.toString());
        assessment.put("questions", List.of(
                Map.of("type", "SINGLE_CHOICE", "prompt", "Ich ___ müde.", "points", 1, "options", List.of(
                        Map.of("text", "bin", "correct", true), Map.of("text", "ist", "correct", false))),
                Map.of("type", "ESSAY", "prompt", "Beschreibe deinen Tag.", "points", 3)));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/assessment"), assessment), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        return new Exam(teacher, courseId, itemId);
    }

    private String student(Exam exam) throws Exception {
        String student = signUp(uniqueEmail("exam-student"), "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + exam.courseId() + "/enrollments"), Map.of()), student))
                .andExpect(jsonPath("$.status").value("APPROVED"));
        return student;
    }

    private Session start(Exam exam, String student) throws Exception {
        MvcResult r = mvc.perform(auth(post("/api/student/items/" + exam.itemId() + "/attempts"), student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS")).andReturn();
        String choiceQ = read(r, "$.questions[?(@.type=='SINGLE_CHOICE')].id").toString().replaceAll("[\\[\\]\"]", "");
        String essayQ = read(r, "$.questions[?(@.type=='ESSAY')].id").toString().replaceAll("[\\[\\]\"]", "");
        String right = read(r, "$.questions[?(@.type=='SINGLE_CHOICE')].options[?(@.text=='bin')].id").toString()
                .replaceAll("[\\[\\]\"]", "");
        String wrong = read(r, "$.questions[?(@.type=='SINGLE_CHOICE')].options[?(@.text=='ist')].id").toString()
                .replaceAll("[\\[\\]\"]", "");
        return new Session(read(r, "$.id"), choiceQ, right, wrong, essayQ);
    }

    private Map<String, Object> answer(String questionId, List<String> options, String text) {
        Map<String, Object> m = new HashMap<>();
        m.put("questionId", questionId);
        m.put("selectedOptionIds", options);
        m.put("textAnswer", text);
        return m;
    }

    private void autosave(String student, Session s, Object... answers) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + s.id() + "/answers"),
                Map.of("answers", List.of(answers))), student)).andExpect(status().isNoContent());
    }

    /** Moves the attempt into the past: started 30 min ago, deadline 2 min ago (beyond the grace period). */
    private Instant expire(Session s) {
        Instant deadline = Instant.now().minus(Duration.ofMinutes(2)).truncatedTo(ChronoUnit.MILLIS);
        backdate(s, deadline.minus(Duration.ofMinutes(28)), deadline);
        return deadline;
    }

    private void backdate(Session s, Instant startedAt, Instant deadline) {
        jdbc.update("update attempts set started_at = ?, deadline = ? where id = ?",
                java.sql.Timestamp.from(startedAt), deadline == null ? null : java.sql.Timestamp.from(deadline),
                UUID.fromString(s.id()));
    }

    @Test
    void autosaveStoresDraftsAndResumeRestoresThem() throws Exception {
        Exam exam = exam(60, 0, null, null);
        String student = student(exam);
        Session s = start(exam, student);

        // unknown question ids are ignored, option ids of other questions are dropped
        autosave(student, s, answer(s.choiceQ(), List.of(s.wrongOpt(), UUID.randomUUID().toString()), null),
                answer(s.essayQ(), List.of(), "Ich stehe früh auf."),
                answer(UUID.randomUUID().toString(), List.of(), "egal"));
        // a later autosave only changes the listed questions
        autosave(student, s, answer(s.choiceQ(), List.of(s.rightOpt()), null));

        // resume (e.g. on another device) returns the saved drafts
        mvc.perform(auth(post("/api/student/items/" + exam.itemId() + "/attempts"), student))
                .andExpect(jsonPath("$.id").value(s.id()))
                .andExpect(jsonPath("$.deadline").exists())
                .andExpect(jsonPath("$.timeLimitMinutes").value(60))
                .andExpect(jsonPath("$.serverTime").exists())
                .andExpect(jsonPath("$.savedAnswers.length()").value(2))
                .andExpect(jsonPath("$.savedAnswers[?(@.questionId=='" + s.choiceQ() + "')].selectedOptionIds[0]")
                        .value(s.rightOpt()))
                .andExpect(jsonPath("$.savedAnswers[?(@.questionId=='" + s.choiceQ() + "')].selectedOptionIds.length()")
                        .value(1))
                .andExpect(jsonPath("$.savedAnswers[?(@.questionId=='" + s.essayQ() + "')].textAnswer")
                        .value("Ich stehe früh auf."));

        // only the owner may autosave (others get 404, like for any foreign attempt)
        String other = student(exam);
        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + s.id() + "/answers"), Map.of("answers", List.of())),
                        other))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ATTEMPT_NOT_FOUND"));
        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + s.id() + "/answers"), Map.of("answers", List.of())),
                        exam.teacher()))
                .andExpect(status().isNotFound());

        // a normal submission within the time: payload wins, not auto-submitted
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + s.id() + "/submit"), Map.of("answers", List.of(
                        answer(s.choiceQ(), List.of(s.rightOpt()), null),
                        answer(s.essayQ(), List.of(), "Final text")))), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autoSubmitted").value(false))
                .andExpect(jsonPath("$.late").value(false))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + s.id() + "/answers"), Map.of("answers", List.of())),
                        student))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ATTEMPT_ALREADY_SUBMITTED"));
    }

    @Test
    void submitAfterDeadlineAutoSubmitsSavedDraftsAndIgnoresPayload() throws Exception {
        Exam exam = exam(30, 0, null, null);
        String student = student(exam);
        Session s = start(exam, student);
        autosave(student, s, answer(s.choiceQ(), List.of(s.rightOpt()), null));
        Instant deadline = expire(s);

        MvcResult r = mvc.perform(auth(jsonBody(post("/api/student/attempts/" + s.id() + "/submit"), Map.of("answers",
                        List.of(answer(s.choiceQ(), List.of(s.wrongOpt()), null),
                                answer(s.essayQ(), List.of(), "Written after the deadline")))), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autoSubmitted").value(true))
                .andExpect(jsonPath("$.late").value(false))
                // the essay was left blank in the drafts → nothing to grade by hand → GRADED
                .andExpect(jsonPath("$.status").value("GRADED"))
                .andExpect(jsonPath("$.score").value(1.0))
                .andExpect(jsonPath("$.answers[?(@.questionId=='" + s.essayQ() + "')].textAnswer").value(
                        org.hamcrest.Matchers.contains((Object) null)))
                .andReturn();
        assertThat(Instant.parse(read(r, "$.submittedAt"))).isEqualTo(deadline);

        // the student's list shows it as auto-submitted
        mvc.perform(auth(get("/api/student/items/" + exam.itemId() + "/attempts"), student))
                .andExpect(jsonPath("$[0].autoSubmitted").value(true));
    }

    @Test
    void autosaveAfterExpiryIsRejectedAndFinalizesTheAttempt() throws Exception {
        Exam exam = exam(10, 0, null, null);
        String student = student(exam);
        Session s = start(exam, student);
        autosave(student, s, answer(s.essayQ(), List.of(), "Mein Tag war schön."));
        expire(s);

        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + s.id() + "/answers"), Map.of("answers",
                        List.of(answer(s.essayQ(), List.of(), "too late")))), student))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTEMPT_EXPIRED"));
        // the finalization was committed despite the 409; essays wait for grading
        mvc.perform(auth(get("/api/student/attempts/" + s.id()), student))
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.autoSubmitted").value(true))
                .andExpect(jsonPath("$.pendingManualGrading").value(true))
                .andExpect(jsonPath("$.answers[?(@.questionId=='" + s.essayQ() + "')].textAnswer")
                        .value(org.hamcrest.Matchers.contains("Mein Tag war schön.")));
    }

    @Test
    void sweeperFinalizesExpiredAttemptsAndNotifiesTheInstructor() throws Exception {
        Exam exam = exam(45, 0, null, null);
        String expiredStudent = student(exam);
        String activeStudent = student(exam);
        Session expired = start(exam, expiredStudent);
        Session active = start(exam, activeStudent);
        autosave(expiredStudent, expired, answer(expired.choiceQ(), List.of(expired.rightOpt()), null),
                answer(expired.essayQ(), List.of(), "Abgebrochen, aber gespeichert."));
        expire(expired);

        assertThat(sweeper.sweep(Instant.now())).isGreaterThanOrEqualTo(1);
        assertThat(sweeper.sweep(Instant.now())).isZero(); // idempotent

        tx.executeWithoutResult(t -> {
            var a = attemptRepo.findById(UUID.fromString(expired.id())).orElseThrow();
            assertThat(a.getStatus().name()).isEqualTo("SUBMITTED");
            assertThat(a.isAutoSubmitted()).isTrue();
            assertThat(a.getSubmittedAt()).isEqualTo(a.getDeadline());
            assertThat(a.getScore()).isEqualTo(1.0);
            assertThat(attemptRepo.findById(UUID.fromString(active.id())).orElseThrow().getStatus().name())
                    .isEqualTo("IN_PROGRESS");
        });
        mvc.perform(auth(get("/api/instructor/items/" + exam.itemId() + "/attempts"), exam.teacher()))
                .andExpect(jsonPath("$[?(@.id=='" + expired.id() + "')].autoSubmitted").value(
                        org.hamcrest.Matchers.contains(true)))
                .andExpect(jsonPath("$[?(@.id=='" + active.id() + "')].status").value(
                        org.hamcrest.Matchers.contains("IN_PROGRESS")));
        mvc.perform(auth(get("/api/notifications"), exam.teacher()))
                .andExpect(jsonPath("$.content[?(@.type=='ATTEMPT_SUBMITTED')]").isNotEmpty());
    }

    @Test
    void startAfterExpiryFinalizesAndStartsANewAttemptOrRefuses() throws Exception {
        Exam exam = exam(20, 2, null, null);
        String student = student(exam);
        Session first = start(exam, student);
        expire(first);

        Session second = start(exam, student);
        assertThat(second.id()).isNotEqualTo(first.id());
        mvc.perform(auth(get("/api/student/attempts/" + first.id()), student))
                .andExpect(jsonPath("$.autoSubmitted").value(true))
                .andExpect(jsonPath("$.status").value("GRADED"));

        expire(second);
        mvc.perform(auth(post("/api/student/items/" + exam.itemId() + "/attempts"), student))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MAX_ATTEMPTS_REACHED"));
        // the expired attempt was still submitted (not rolled back with the 409)
        mvc.perform(auth(get("/api/student/items/" + exam.itemId() + "/attempts"), student))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.status=='IN_PROGRESS')]").isEmpty())
                .andExpect(jsonPath("$[?(@.autoSubmitted==true)]").value(org.hamcrest.Matchers.hasSize(2)));
    }

    @Test
    void closingWindowFinalizesAttemptsWithoutTimeLimit() throws Exception {
        Instant until = Instant.now().plus(Duration.ofHours(2));
        Exam exam = exam(null, 0, null, until);
        String lazyStudent = student(exam);
        String sweptStudent = student(exam);
        Session lazy = start(exam, lazyStudent);
        Session swept = start(exam, sweptStudent);
        // the session shows the window end as effective deadline although there is no time limit
        mvc.perform(auth(post("/api/student/items/" + exam.itemId() + "/attempts"), lazyStudent))
                .andExpect(jsonPath("$.id").value(lazy.id()))
                .andExpect(jsonPath("$.timeLimitMinutes").doesNotExist())
                .andExpect(jsonPath("$.deadline").value(org.hamcrest.Matchers.notNullValue()));
        autosave(lazyStudent, lazy, answer(lazy.choiceQ(), List.of(lazy.rightOpt()), null));

        Instant closed = Instant.now().minus(Duration.ofMinutes(5)).truncatedTo(ChronoUnit.MILLIS);
        backdate(lazy, closed.minus(Duration.ofHours(1)), null);
        backdate(swept, closed.minus(Duration.ofHours(1)), null);
        tx.executeWithoutResult(t -> assessmentRepo.findByItemId(UUID.fromString(exam.itemId())).orElseThrow()
                .setAvailableUntil(closed));

        // lazily, when the learner opens the item again
        mvc.perform(auth(get("/api/student/items/" + exam.itemId()), lazyStudent))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assessment.inProgressAttemptId").doesNotExist());
        MvcResult r = mvc.perform(auth(get("/api/student/attempts/" + lazy.id()), lazyStudent))
                .andExpect(jsonPath("$.autoSubmitted").value(true))
                .andExpect(jsonPath("$.score").value(1.0))
                .andReturn();
        assertThat(Instant.parse(read(r, "$.submittedAt"))).isEqualTo(closed);

        // by the sweeper
        assertThat(sweeper.sweep(Instant.now())).isGreaterThanOrEqualTo(1);
        tx.executeWithoutResult(t -> {
            var a = attemptRepo.findById(UUID.fromString(swept.id())).orElseThrow();
            assertThat(a.isAutoSubmitted()).isTrue();
            assertThat(a.getSubmittedAt()).isEqualTo(closed);
        });
        // starting again is refused because the window is closed
        mvc.perform(auth(post("/api/student/items/" + exam.itemId() + "/attempts"), lazyStudent))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_AVAILABLE"));
    }

    @Test
    void scheduleShowsAssessmentWindows() throws Exception {
        Instant from = Instant.now().plus(Duration.ofDays(2)).truncatedTo(ChronoUnit.MINUTES);
        Instant until = from.plus(Duration.ofHours(3));
        Exam exam = exam(60, 1, from, until);
        mvc.perform(auth(get("/api/instructor/schedule").param("courseId", exam.courseId()), exam.teacher()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("ITEM:" + exam.itemId() + ":OPENS"))
                .andExpect(jsonPath("$[0].action").value("OPENS"))
                .andExpect(jsonPath("$[0].entityType").value("ITEM"))
                .andExpect(jsonPath("$[0].itemType").value("EXAM"))
                .andExpect(jsonPath("$[1].id").value("ITEM:" + exam.itemId() + ":CLOSES"))
                .andExpect(jsonPath("$[1].action").value("CLOSES"));
        // outside the requested range → nothing
        mvc.perform(auth(get("/api/instructor/schedule").param("courseId", exam.courseId())
                        .param("from", until.plusSeconds(60).toString())
                        .param("to", until.plus(Duration.ofDays(1)).toString()), exam.teacher()))
                .andExpect(jsonPath("$.length()").value(0));
        // other instructors don't see it
        String other = signUp(uniqueEmail("exam-other"), "INSTRUCTOR");
        mvc.perform(auth(get("/api/instructor/schedule"), other)).andExpect(jsonPath("$.length()").value(0));
    }
}
