package me.amanullah.course.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.springframework.mock.web.MockMultipartFile;

/** Helpers for the flashcard, assignment and live session tests. */
abstract class PracticeTestSupport extends CommunicationTestSupport {

    record Setup(String teacher, String courseId, String moduleId) {
    }

    protected static Map<String, Object> published() {
        Map<String, Object> m = new HashMap<>();
        m.put("publishStatus", "PUBLISHED");
        m.put("publishAt", null);
        m.put("unpublishAt", null);
        return m;
    }

    /** A live OPEN course (learners are approved on application) with one published module. */
    protected Setup course() throws Exception {
        String teacher = signUp(uniqueEmail("prac-teacher"), "INSTRUCTOR");
        String courseId = liveCourse(teacher, "Übungskurs", "OPEN");
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 1")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/publication"), published()), teacher))
                .andExpect(status().isOk());
        return new Setup(teacher, courseId, moduleId);
    }

    /** Creates and publishes an item of the given type. */
    protected String item(Setup s, String type, String title) throws Exception {
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + s.moduleId() + "/items"),
                Map.of("type", type, "title", title, "body", "<p>Anleitung</p>")), s.teacher()))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + id + "/publication"), published()), s.teacher()))
                .andExpect(status().isOk());
        return id;
    }

    /** A verified student that is enrolled in the course; returns the access token. */
    protected String learner(Setup s, String emailPrefix) throws Exception {
        String token = signUp(uniqueEmail(emailPrefix), "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + s.courseId() + "/enrollments"), Map.of()), token))
                .andExpect(status().isCreated());
        return token;
    }

    /** Uploads a small text file and returns the media id. */
    protected String upload(String token, String name, String content) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", name, "text/plain",
                content.getBytes(StandardCharsets.UTF_8));
        return read(mvc.perform(multipart("/api/media").file(file)
                .header("Authorization", "Bearer " + token)).andExpect(status().isCreated()).andReturn(), "$.id");
    }
}
