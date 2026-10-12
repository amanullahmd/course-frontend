package me.amanullah.course.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Optional items stay out of progress, reports and certificate criteria. */
class ProgressRequiredTest extends ReleaseTestSupport {

    @Test
    void progressCountsRequiredItemsOnly() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        // required: A, C ; optional: B, QUIZ, D
        for (String optional : List.of(f.b(), f.quiz(), f.d())) {
            itemRules(f.teacher(), optional, rules(false, null, null));
        }
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s))
                .andExpect(jsonPath("$.progressPercent").value(0))
                .andExpect(jsonPath("$.requiredCount").value(2));
        complete(s, f.b()); // optional: no effect
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s))
                .andExpect(jsonPath("$.progressPercent").value(0))
                .andExpect(jsonPath("$.completedRequiredCount").value(0));
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s))
                .andExpect(jsonPath("$.progressPercent").value(50))
                .andExpect(jsonPath("$.completedRequiredCount").value(1));
        complete(s, f.c());
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s))
                .andExpect(jsonPath("$.progressPercent").value(100));
        // the learner's enrollment list and the instructor's reports agree
        mvc.perform(auth(get("/api/student/enrollments"), s)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].progressPercent").value(100));
        mvc.perform(auth(get("/api/instructor/courses/" + f.courseId() + "/enrollments"), f.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].progressPercent").value(100));
        mvc.perform(auth(get("/api/instructor/courses/" + f.courseId() + "/reports/gradebook"), f.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rows[0].progressPercent").value(100))
                .andExpect(jsonPath("$.rows[0].totalLiveItems").value(2));
    }

    @Test
    void ifNothingIsRequiredEveryItemCounts() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        for (String id : List.of(f.a(), f.b(), f.quiz(), f.c(), f.d())) {
            itemRules(f.teacher(), id, rules(false, null, null));
        }
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s))
                .andExpect(jsonPath("$.progressPercent").value(20));
    }

    @Test
    void certificateIsIssuedOnceTheRequiredItemsAreDone() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        for (String optional : List.of(f.b(), f.c(), f.d())) {
            itemRules(f.teacher(), optional, rules(false, null, null));
        }
        Map<String, Object> settings = new HashMap<>();
        settings.put("enabled", true);
        settings.put("minProgressPercent", 100);
        settings.put("requireAssessmentsPassed", true);
        settings.put("showScore", true);
        settings.put("language", "LEARNER");
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + f.courseId() + "/certificate-settings"), settings),
                f.teacher())).andExpect(status().isOk());
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/certificate"), s))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        takeQuiz(s, f.quiz(), "Ja"); // optional items B, C, D stay untouched
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/certificate"), s))
                .andExpect(jsonPath("$.status").value("ISSUED"));
    }
}
