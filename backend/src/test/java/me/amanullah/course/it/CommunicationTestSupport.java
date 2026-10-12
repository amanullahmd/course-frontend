package me.amanullah.course.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import me.amanullah.course.user.Role;

/** Helpers for announcement and messaging tests: live courses, enrollments, user ids. */
abstract class CommunicationTestSupport extends IntegrationTestSupport {

    /** Creates and publishes a course; returns its id. */
    protected String liveCourse(String teacherToken, String title, String mode) throws Exception {
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of("title", title,
                        "level", "A1", "tags", List.of(), "enrollmentMode", mode)), teacherToken))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + id + "/publication"),
                Map.of("publishStatus", "PUBLISHED")), teacherToken)).andExpect(status().isOk());
        return id;
    }

    /** Applies; returns the enrollment id. */
    protected String apply(String studentToken, String courseId) throws Exception {
        return read(mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"),
                Map.of()), studentToken)).andExpect(status().isCreated()).andReturn(), "$.id");
    }

    protected void approve(String teacherToken, String enrollmentId) throws Exception {
        mvc.perform(auth(post("/api/instructor/enrollments/" + enrollmentId + "/approve"), teacherToken))
                .andExpect(status().isOk());
    }

    protected void reject(String teacherToken, String enrollmentId) throws Exception {
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/" + enrollmentId + "/reject"), Map.of()),
                teacherToken)).andExpect(status().isOk());
    }

    protected String userId(String email) {
        return tx.execute(s -> users.findByEmailIgnoreCase(email).orElseThrow().getId().toString());
    }

    protected void setLocale(String email, String locale) {
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(email).orElseThrow().setLocale(locale));
    }

    protected String admin(String email) throws Exception {
        signUp(email, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(email).orElseThrow().setRole(Role.ADMIN));
        return login(email);
    }

    protected static String randomId() {
        return UUID.randomUUID().toString();
    }
}
