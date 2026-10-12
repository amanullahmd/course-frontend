package me.amanullah.course.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

/** Builds a published course (two modules, a quiz) and offers helpers for release rules. */
abstract class ReleaseTestSupport extends IntegrationTestSupport {

    @Autowired
    protected JdbcTemplate jdbc;

    /** M1: A, B, QUIZ (1 single choice, passing 60); M2: C, D. All published, OPEN enrollment. */
    protected record Fixture(String teacher, String courseId, String m1, String m2, String a, String b, String quiz,
                             String c, String d) {
    }

    protected Map<String, Object> published() {
        Map<String, Object> m = new HashMap<>();
        m.put("publishStatus", "PUBLISHED");
        return m;
    }

    protected void publish(String teacher, String base) throws Exception {
        mvc.perform(auth(jsonBody(put(base + "/publication"), published()), teacher)).andExpect(status().isOk());
    }

    protected String createItem(String teacher, String moduleId, String type, String title) throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("title", title);
        m.put("body", "<p>" + title + "</p>");
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"), m), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/items/" + id);
        return id;
    }

    protected Fixture fixture() throws Exception {
        String teacher = signUp(uniqueEmail("rel-teacher"), "INSTRUCTOR");
        String courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Release Kurs", "level", "A1", "enrollmentMode", "OPEN")), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/courses/" + courseId);
        String m1 = module(teacher, courseId, "Modul 1");
        String m2 = module(teacher, courseId, "Modul 2");
        String a = createItem(teacher, m1, "TEXT", "A");
        String b = createItem(teacher, m1, "TEXT", "B");
        String quiz = createItem(teacher, m1, "QUIZ", "Quiz");
        String c = createItem(teacher, m2, "TEXT", "C");
        String d = createItem(teacher, m2, "TEXT", "D");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz + "/assessment"), Map.of(
                "passingScore", 60, "questions", List.of(Map.of("type", "SINGLE_CHOICE", "prompt", "Hallo?",
                        "points", 2, "options", List.of(Map.of("text", "Ja", "correct", true),
                                Map.of("text", "Nein", "correct", false)))))), teacher)).andExpect(status().isOk());
        return new Fixture(teacher, courseId, m1, m2, a, b, quiz, c, d);
    }

    protected String module(String teacher, String courseId, String title) throws Exception {
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", title)), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        publish(teacher, "/api/instructor/modules/" + id);
        return id;
    }

    protected String enrolledStudent(Fixture f) throws Exception {
        String student = signUp(uniqueEmail("rel-student"), "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + f.courseId() + "/enrollments"), Map.of()), student))
                .andExpect(status().isCreated());
        return student;
    }

    protected Map<String, Object> rules(Boolean required, Integer offset, List<Map<String, Object>> prerequisites) {
        Map<String, Object> m = new HashMap<>();
        m.put("required", required);
        m.put("releaseOffsetDays", offset);
        m.put("prerequisites", prerequisites == null ? List.of() : prerequisites);
        return m;
    }

    protected static Map<String, Object> prereq(String itemId, Integer minPercent) {
        Map<String, Object> m = new HashMap<>();
        m.put("itemId", itemId);
        m.put("minPercent", minPercent);
        return m;
    }

    protected void itemRules(String teacher, String itemId, Map<String, Object> rules) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/release"), rules), teacher))
                .andExpect(status().isOk());
    }

    protected void moduleRules(String teacher, String moduleId, Map<String, Object> rules) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/release"), rules), teacher))
                .andExpect(status().isOk());
    }

    protected void progression(String teacher, String courseId, String progression) throws Exception {
        Map<String, Object> course = new HashMap<>();
        course.put("title", "Release Kurs");
        course.put("level", "A1");
        course.put("enrollmentMode", "OPEN");
        course.put("progression", progression);
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId), course), teacher))
                .andExpect(status().isOk());
    }

    /** Pretends the learner's enrollment was approved this many days ago. */
    protected void approvedDaysAgo(String courseId, long days) {
        jdbc.update("update enrollments set decided_at = ? where course_id = ?",
                java.sql.Timestamp.from(Instant.now().minus(java.time.Duration.ofDays(days))),
                java.util.UUID.fromString(courseId));
    }

    protected void complete(String student, String itemId) throws Exception {
        mvc.perform(auth(post("/api/student/items/" + itemId + "/complete"), student)).andExpect(status().isNoContent());
    }

    /** Takes the quiz with the given option ("Ja" passes, "Nein" fails). */
    @SuppressWarnings("unchecked")
    protected void takeQuiz(String student, String quizId, String option) throws Exception {
        MvcResult session = mvc.perform(auth(post("/api/student/items/" + quizId + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
        String id = read(session, "$.id");
        List<Map<String, Object>> questions = read(session, "$.questions");
        List<Map<String, Object>> answers = new ArrayList<>();
        for (Map<String, Object> q : questions) {
            List<Object> ids = ((List<Map<String, Object>>) q.get("options")).stream()
                    .filter(o -> option.equals(o.get("text"))).map(o -> o.get("id")).toList();
            answers.add(Map.of("questionId", q.get("id"), "selectedOptionIds", ids));
        }
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + id + "/submit"), Map.of("answers", answers)), student))
                .andExpect(status().isOk());
    }

    protected MvcResult getItem(String token, String itemId) throws Exception {
        return mvc.perform(auth(get("/api/student/items/" + itemId), token)).andReturn();
    }
}
