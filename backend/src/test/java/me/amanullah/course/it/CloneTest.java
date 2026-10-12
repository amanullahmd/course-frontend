package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Duplicating items and modules and cloning whole courses. */
class CloneTest extends ReleaseTestSupport {

    private String upload(String token) throws Exception {
        return read(mvc.perform(MockMvcRequestBuilders.multipart("/api/media")
                .file(new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes()))
                .header("Authorization", "Bearer " + token)).andExpect(status().isCreated()).andReturn(), "$.id");
    }

    private Map<String, Object> clone(String title, Integer shiftDays, boolean keepSchedule) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("shiftDays", shiftDays);
        m.put("keepSchedule", keepSchedule);
        return m;
    }

    @Test
    void duplicatesAnItemAfterTheSourceWithRulesAndAssessment() throws Exception {
        Fixture f = fixture();
        itemRules(f.teacher(), f.quiz(), rules(false, 5, List.of(prereq(f.a(), null))));
        String copy = read(mvc.perform(auth(post("/api/instructor/items/" + f.quiz() + "/duplicate"), f.teacher()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Quiz (copy)"))
                .andExpect(jsonPath("$.publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.required").value(false))
                .andExpect(jsonPath("$.releaseOffsetDays").value(5))
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.a()))
                .andExpect(jsonPath("$.position").value(3))
                .andExpect(jsonPath("$.assessment.questionCount").value(1)).andReturn(), "$.id");
        assertThat(copy).isNotEqualTo(f.quiz());
        mvc.perform(auth(get("/api/instructor/items/" + copy + "/assessment"), f.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.passingScore").value(60))
                .andExpect(jsonPath("$.questions[0].options", hasSize(2)))
                .andExpect(jsonPath("$.questions[0].options[0].correct").value(true));
        // the source is untouched and the copy has its own question and option ids
        String srcQ = read(mvc.perform(auth(get("/api/instructor/items/" + f.quiz() + "/assessment"), f.teacher()))
                .andReturn(), "$.questions[0].id");
        String copyQ = read(mvc.perform(auth(get("/api/instructor/items/" + copy + "/assessment"), f.teacher()))
                .andReturn(), "$.questions[0].id");
        assertThat(copyQ).isNotEqualTo(srcQ);
        // later items moved by one
        mvc.perform(auth(get("/api/instructor/courses/" + f.courseId()), f.teacher()))
                .andExpect(jsonPath("$.modules[0].items", hasSize(4)))
                .andExpect(jsonPath("$.modules[0].items[3].title").value("Quiz (copy)"));
    }

    @Test
    void duplicatesIntoAnotherModuleAndInGermanWithKopieSuffix() throws Exception {
        Fixture f = fixture();
        mvc.perform(auth(jsonBody(post("/api/instructor/items/" + f.a() + "/duplicate"),
                        Map.of("targetModuleId", f.m2())), f.teacher()).header("Accept-Language", "de"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("A (Kopie)"))
                .andExpect(jsonPath("$.moduleId").value(f.m2())).andExpect(jsonPath("$.position").value(2));
        mvc.perform(auth(post("/api/instructor/items/" + f.a() + "/duplicate"), f.teacher()).contentType("application/json")
                .content("{}")).andExpect(status().isCreated());
        // a module of another course is rejected
        Fixture other = fixture();
        mvc.perform(auth(jsonBody(post("/api/instructor/items/" + f.a() + "/duplicate"),
                Map.of("targetModuleId", other.m1())), f.teacher())).andExpect(status().is4xxClientError());
        mvc.perform(auth(jsonBody(post("/api/instructor/items/" + f.a() + "/duplicate"),
                Map.of("targetModuleId", java.util.UUID.randomUUID())), f.teacher())).andExpect(status().isNotFound());
    }

    @Test
    void duplicatesAModuleWithItemsAndRemapsInternalPrerequisites() throws Exception {
        Fixture f = fixture();
        itemRules(f.teacher(), f.d(), rules(true, 2, List.of(prereq(f.c(), null), prereq(f.a(), null))));
        moduleRules(f.teacher(), f.m2(), rules(null, 4, List.of(prereq(f.b(), null))));
        String json = mvc.perform(auth(post("/api/instructor/modules/" + f.m2() + "/duplicate"), f.teacher()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Modul 2 (copy)"))
                .andExpect(jsonPath("$.publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.position").value(2))
                .andExpect(jsonPath("$.releaseOffsetDays").value(4))
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.b()))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].publishStatus").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        String newC = com.jayway.jsonpath.JsonPath.read(json, "$.items[0].id");
        List<Map<String, Object>> prereqs = com.jayway.jsonpath.JsonPath.read(json, "$.items[1].prerequisites");
        // C inside the module points at the copy of C, A outside the module still points at A
        assertThat(prereqs.stream().map(p -> (String) p.get("itemId"))).containsExactlyInAnyOrder(newC, f.a());
        // the original is unchanged
        mvc.perform(auth(get("/api/instructor/items/" + f.d()), f.teacher()))
                .andExpect(jsonPath("$.prerequisites[*].itemId", org.hamcrest.Matchers.containsInAnyOrder(f.c(), f.a())));
    }

    @Test
    void clonesAWholeCourseAsAnIndependentDraft() throws Exception {
        Fixture f = fixture();
        String media = upload(f.teacher());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a()), Map.of("type", "TEXT", "title", "A",
                "body", "<p>A</p>", "attachmentIds", List.of(media))), f.teacher())).andExpect(status().isOk());
        progression(f.teacher(), f.courseId(), "SEQUENTIAL_MODULES");
        itemRules(f.teacher(), f.c(), rules(false, 3, List.of(prereq(f.quiz(), 70))));
        moduleRules(f.teacher(), f.m2(), rules(null, 1, List.of(prereq(f.a(), null))));
        String student = enrolledStudent(f);
        complete(student, f.a());
        takeQuiz(student, f.quiz(), "Ja");

        String json = mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                        clone("Release Kurs 2", null, true)), f.teacher()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Release Kurs 2"))
                .andExpect(jsonPath("$.publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.progression").value("SEQUENTIAL_MODULES"))
                .andExpect(jsonPath("$.clonedFromId").value(f.courseId()))
                .andExpect(jsonPath("$.studentCount").value(0))
                .andExpect(jsonPath("$.pendingCount").value(0))
                .andExpect(jsonPath("$.modules", hasSize(2)))
                .andExpect(jsonPath("$.modules[0].publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.modules[0].items", hasSize(3)))
                .andExpect(jsonPath("$.modules[0].items[0].publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.modules[0].items[0].attachments[0].id").value(media))
                .andExpect(jsonPath("$.modules[1].releaseOffsetDays").value(1))
                .andExpect(jsonPath("$.modules[1].items[0].required").value(false))
                .andExpect(jsonPath("$.modules[1].items[0].releaseOffsetDays").value(3))
                .andReturn().getResponse().getContentAsString();
        String newCourse = com.jayway.jsonpath.JsonPath.read(json, "$.id");
        String slug = com.jayway.jsonpath.JsonPath.read(json, "$.slug");
        assertThat(newCourse).isNotEqualTo(f.courseId());
        assertThat(slug).isNotEqualTo("release-kurs").startsWith("release-kurs");
        // prerequisites point to the copied items, not the originals
        String newQuiz = com.jayway.jsonpath.JsonPath.read(json, "$.modules[0].items[2].id");
        String newA = com.jayway.jsonpath.JsonPath.read(json, "$.modules[0].items[0].id");
        assertThat(newQuiz).isNotEqualTo(f.quiz());
        mvc.perform(auth(get("/api/instructor/courses/" + newCourse), f.teacher()))
                .andExpect(jsonPath("$.modules[1].items[0].prerequisites[0].itemId").value(newQuiz))
                .andExpect(jsonPath("$.modules[1].items[0].prerequisites[0].minPercent").value(70))
                .andExpect(jsonPath("$.modules[1].prerequisites[0].itemId").value(newA));
        // the quiz was copied with its question; enrollments, progress and attempts were not copied
        mvc.perform(auth(get("/api/instructor/items/" + newQuiz + "/assessment"), f.teacher()))
                .andExpect(jsonPath("$.questions", hasSize(1))).andExpect(jsonPath("$.questions[0].options", hasSize(2)));
        mvc.perform(auth(get("/api/instructor/items/" + newQuiz + "/attempts"), f.teacher()))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(auth(get("/api/instructor/courses/" + newCourse + "/enrollments"), f.teacher()))
                .andExpect(jsonPath("$", hasSize(0)));
        // the original still has its learner and rules
        mvc.perform(auth(get("/api/instructor/courses/" + f.courseId()), f.teacher()))
                .andExpect(jsonPath("$.studentCount").value(1))
                .andExpect(jsonPath("$.modules[1].items[0].prerequisites[0].itemId").value(f.quiz()));
        // the draft is not visible to learners
        mvc.perform(auth(get("/api/student/courses/" + newCourse + "/learn"), student)).andExpect(status().isNotFound());
    }

    @Test
    void shiftsOrDropsDates() throws Exception {
        Fixture f = fixture();
        String from = "2030-03-01T10:00:00Z";
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + f.m2() + "/publication"),
                Map.of("publishStatus", "PUBLISHED", "publishAt", from, "unpublishAt", "2030-06-01T10:00:00Z")),
                f.teacher())).andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.quiz() + "/assessment"), Map.of(
                "passingScore", 60, "availableFrom", from, "availableUntil", "2030-03-08T10:00:00Z",
                "questions", List.of(Map.of("type", "SINGLE_CHOICE", "prompt", "Hallo?", "points", 2, "options",
                        List.of(Map.of("text", "Ja", "correct", true), Map.of("text", "Nein", "correct", false)))))),
                f.teacher())).andExpect(status().isOk());
        String shifted = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("Verschoben", 14, true)), f.teacher())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.modules[1].publishAt").value("2030-03-15T10:00:00Z"))
                .andExpect(jsonPath("$.modules[1].unpublishAt").value("2030-06-15T10:00:00Z"))
                .andExpect(jsonPath("$.modules[1].publishStatus").value("DRAFT"))
                .andReturn(), "$.modules[0].items[2].id");
        mvc.perform(auth(get("/api/instructor/items/" + shifted + "/assessment"), f.teacher()))
                .andExpect(jsonPath("$.availableFrom").value("2030-03-15T10:00:00Z"))
                .andExpect(jsonPath("$.availableUntil").value("2030-03-22T10:00:00Z"));
        String earlier = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("Früher", -7, true)), f.teacher())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.modules[1].publishAt").value("2030-02-22T10:00:00Z")).andReturn(), "$.id");
        assertThat(earlier).isNotBlank();
        String dropped = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("Ohne Termine", 14, false)), f.teacher())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.modules[1].publishAt").value(nullValue()))
                .andExpect(jsonPath("$.modules[1].unpublishAt").value(nullValue()))
                .andReturn(), "$.modules[0].items[2].id");
        mvc.perform(auth(get("/api/instructor/items/" + dropped + "/assessment"), f.teacher()))
                .andExpect(jsonPath("$.availableFrom").value(nullValue()))
                .andExpect(jsonPath("$.availableUntil").value(nullValue()));
    }

    @Test
    void ownershipAndBadInput() throws Exception {
        Fixture f = fixture();
        String intruder = signUp(uniqueEmail("clone-intruder"), "INSTRUCTOR");
        String student = signUp(uniqueEmail("clone-student"), "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("Gestohlen", null, true)), intruder)).andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/instructor/items/" + f.a() + "/duplicate"), intruder)).andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/instructor/modules/" + f.m1() + "/duplicate"), intruder)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("Student", null, true)), student)).andExpect(status().isForbidden());
        mvc.perform(post("/api/instructor/courses/" + f.courseId() + "/clone").contentType("application/json")
                .content("{}")).andExpect(status().isUnauthorized());
        // bad bodies
        for (String body : new String[]{"{}", "{\"title\":\"  \"}", "{\"title\":\"x\",\"shiftDays\":99999}",
                "{\"title\":\"x\",\"shiftDays\":\"abc\"}", "not json", "[]"}) {
            mvc.perform(auth(post("/api/instructor/courses/" + f.courseId() + "/clone").contentType("application/json")
                    .content(body), f.teacher())).andExpect(status().isBadRequest());
        }
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + f.courseId() + "/clone"),
                clone("x".repeat(201), null, true)), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + java.util.UUID.randomUUID() + "/clone"),
                clone("Nix", null, true)), f.teacher())).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/nope/clone"), clone("Nix", null, true)), f.teacher()))
                .andExpect(status().isBadRequest());
        // duplicating a title that is already at the maximum length stays within the limit
        String longTitle = "T".repeat(200);
        String id = createItem(f.teacher(), f.m1(), "TEXT", longTitle);
        mvc.perform(auth(post("/api/instructor/items/" + id + "/duplicate"), f.teacher())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.endsWith(" (copy)")));
    }
}
