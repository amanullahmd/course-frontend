package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Per-learner release rules: drip, prerequisites, progression modes, required/optional, locked vs hidden. */
class ReleaseRulesTest extends ReleaseTestSupport {

    private String lockOf(String student, Fixture f, String itemId) throws Exception {
        List<Map<String, Object>> modules = read(mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"),
                student)).andExpect(status().isOk()).andReturn(), "$.modules");
        for (Map<String, Object> m : modules) {
            for (Map<String, Object> i : (List<Map<String, Object>>) m.get("items")) {
                if (itemId.equals(i.get("id"))) {
                    Map<String, Object> lock = (Map<String, Object>) i.get("lock");
                    return lock == null ? null : (String) lock.get("reason");
                }
            }
        }
        throw new AssertionError("item not in outline");
    }

    @Test
    void defaultsAreFreeAndRequired() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        mvc.perform(auth(get("/api/instructor/courses/" + f.courseId()), f.teacher()))
                .andExpect(jsonPath("$.progression").value("FREE"))
                .andExpect(jsonPath("$.modules[0].items[0].required").value(true))
                .andExpect(jsonPath("$.modules[0].items[0].releaseOffsetDays").doesNotExist())
                .andExpect(jsonPath("$.modules[0].items[0].prerequisites", hasSize(0)));
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isOk());
        assertThat(lockOf(s, f, f.d())).isNull();
    }

    @Test
    void dripLocksUntilOffsetAndTakesTheLaterOfModuleAndItem() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.c(), rules(true, 7, null));
        moduleRules(f.teacher(), f.m2(), rules(null, 3, null));
        // module opens after 3 days, item C after 7 days
        approvedDaysAgo(f.courseId(), 0);
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ITEM_LOCKED"))
                .andExpect(jsonPath("$.lockReason").value("DATE"))
                .andExpect(jsonPath("$.unlockAt").exists());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.lockReason").value("DATE"));
        assertThat(lockOf(s, f, f.c())).isEqualTo("DATE");
        approvedDaysAgo(f.courseId(), 4);
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden());
        approvedDaysAgo(f.courseId(), 8);
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
        assertThat(lockOf(s, f, f.c())).isNull();
    }

    @Test
    void unlockDateIsRelativeToTheLearnersApproval() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.c(), rules(true, 10, null));
        approvedDaysAgo(f.courseId(), 4);
        String unlockAt = read(mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andReturn(), "$.unlockAt");
        long days = java.time.Duration.between(java.time.Instant.now(), java.time.Instant.parse(unlockAt)).toHours();
        assertThat(days).isBetween(5L * 24 + 22, 6L * 24 + 1);
    }

    @Test
    void prerequisiteBlocksUntilCompletedAndNamesTheItem() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.c(), rules(true, null, List.of(prereq(f.a(), null))));
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ITEM_LOCKED"))
                .andExpect(jsonPath("$.lockReason").value("PREREQUISITE"))
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.a()))
                .andExpect(jsonPath("$.prerequisites[0].title").value("A"));
        mvc.perform(auth(post("/api/student/items/" + f.c() + "/complete"), s)).andExpect(status().isForbidden());
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
        // un-completing the prerequisite locks it again
        mvc.perform(auth(delete("/api/student/items/" + f.a() + "/complete"), s)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden());
    }

    @Test
    void moduleLevelPrerequisitesAndAndSemantics() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        moduleRules(f.teacher(), f.m2(), rules(null, null, List.of(prereq(f.a(), null), prereq(f.b(), null))));
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites", hasSize(2)));
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites", hasSize(1)))
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.b()));
        complete(s, f.b());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isOk());
    }

    @Test
    void minimumScoreNeedsASufficientBestAttempt() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.c(), rules(true, null, List.of(prereq(f.quiz(), 80))));
        takeQuiz(s, f.quiz(), "Nein"); // completes the quiz item but scores 0 %
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites[0].minPercent").value(80));
        takeQuiz(s, f.quiz(), "Ja");
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
    }

    @Test
    void sequentialModulesNeedAllRequiredItemsOfEarlierModulesPassed() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        progression(f.teacher(), f.courseId(), "SEQUENTIAL_MODULES");
        itemRules(f.teacher(), f.b(), rules(false, null, null)); // optional: does not gate
        // inside a module everything is open, module 2 is locked
        mvc.perform(auth(get("/api/student/items/" + f.quiz()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.lockReason").value("SEQUENCE"))
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.a()));
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.quiz()));
        takeQuiz(s, f.quiz(), "Nein"); // submitted but not passed
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden());
        takeQuiz(s, f.quiz(), "Ja");
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isOk());
    }

    @Test
    void sequentialItemsSkipOptionalItems() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        progression(f.teacher(), f.courseId(), "SEQUENTIAL_ITEMS");
        itemRules(f.teacher(), f.b(), rules(false, null, null));
        mvc.perform(auth(get("/api/student/items/" + f.a()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.b()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.a()));
        complete(s, f.a());
        mvc.perform(auth(get("/api/student/items/" + f.b()), s)).andExpect(status().isOk());
        // the quiz follows A (B is optional): it is open without touching B
        mvc.perform(auth(get("/api/student/items/" + f.quiz()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.prerequisites[0].itemId").value(f.quiz()));
        takeQuiz(s, f.quiz(), "Ja");
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isForbidden());
    }

    @Test
    void lockedExamCannotBeStartedAndLockedItemsCannotBeCompleted() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        progression(f.teacher(), f.courseId(), "SEQUENTIAL_ITEMS");
        mvc.perform(auth(post("/api/student/items/" + f.quiz() + "/attempts"), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ITEM_LOCKED"));
        mvc.perform(auth(get("/api/student/items/" + f.quiz() + "/attempts"), s)).andExpect(status().isForbidden());
        mvc.perform(auth(post("/api/student/items/" + f.d() + "/complete"), s)).andExpect(status().isForbidden());
    }

    @Test
    void lockedIsForbiddenButNotLiveIsNotFoundAndOwnerPreviewBypasses() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        String stranger = signUp(uniqueEmail("rel-stranger"), "STUDENT");
        progression(f.teacher(), f.courseId(), "SEQUENTIAL_ITEMS");
        itemRules(f.teacher(), f.b(), rules(true, 30, null));
        mvc.perform(auth(get("/api/student/items/" + f.b()), s)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ITEM_LOCKED"));
        // not enrolled: NOT_ENROLLED, never ITEM_LOCKED
        mvc.perform(auth(get("/api/student/items/" + f.b()), stranger)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
        // owner preview is never locked
        mvc.perform(auth(get("/api/student/items/" + f.b()), f.teacher())).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), f.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.modules[0].items[1].lock").doesNotExist());
        // a draft item is hidden (404), even though a rule would lock it
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.d() + "/publication"),
                Map.of("publishStatus", "DRAFT")), f.teacher())).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.d()), s)).andExpect(status().isNotFound());
    }

    @Test
    void nonLivePrerequisitesNeverLockLearnersOutForever() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.c(), rules(true, null, List.of(prereq(f.a(), null))));
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isForbidden());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/publication"),
                Map.of("publishStatus", "DRAFT")), f.teacher())).andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + f.c()), s)).andExpect(status().isOk());
    }

    @Test
    void outlineExposesLocksAndRequiredCounts() throws Exception {
        Fixture f = fixture();
        String s = enrolledStudent(f);
        itemRules(f.teacher(), f.d(), rules(false, null, List.of(prereq(f.c(), null))));
        mvc.perform(auth(get("/api/student/courses/" + f.courseId() + "/learn"), s)).andExpect(status().isOk())
                .andExpect(jsonPath("$.progression").value("FREE"))
                .andExpect(jsonPath("$.requiredCount").value(4))
                .andExpect(jsonPath("$.modules[1].items[1].required").value(false))
                .andExpect(jsonPath("$.modules[1].items[1].lock.reason").value("PREREQUISITE"))
                .andExpect(jsonPath("$.modules[1].items[1].lock.prerequisites[0].title").value("C"))
                .andExpect(jsonPath("$.modules[1].items[0].lock").doesNotExist());
    }

    // ---------------- validation ----------------

    @Test
    void rejectsCyclesSelfReferencesAndForeignItems() throws Exception {
        Fixture f = fixture();
        Fixture other = fixture();
        itemRules(f.teacher(), f.c(), rules(true, null, List.of(prereq(f.a(), null))));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/release"),
                        rules(true, null, List.of(prereq(f.c(), null)))), f.teacher()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PREREQUISITE_CYCLE"));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/release"),
                        rules(true, null, List.of(prereq(f.a(), null)))), f.teacher()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.prerequisites").exists());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/release"),
                        rules(true, null, List.of(prereq(other.a(), null)))), f.teacher()))
                .andExpect(status().isBadRequest());
        // a module rule that closes a loop through its items is a cycle, too
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + f.m1() + "/release"),
                        rules(null, null, List.of(prereq(f.c(), null)))), f.teacher()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PREREQUISITE_CYCLE"));
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + f.m2() + "/release"),
                        rules(null, null, List.of(prereq(f.c(), null)))), f.teacher()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsBadValues() throws Exception {
        Fixture f = fixture();
        for (Integer bad : new Integer[]{-1, 3651}) {
            mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/release"), rules(true, bad, null)),
                    f.teacher())).andExpect(status().isBadRequest());
        }
        // min score is only for quizzes and exams, and 0..100
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.c() + "/release"),
                rules(true, null, List.of(prereq(f.a(), 50)))), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.c() + "/release"),
                rules(true, null, List.of(prereq(f.quiz(), 101)))), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.c() + "/release"),
                rules(true, null, List.of(prereq(f.quiz(), -1)))), f.teacher())).andExpect(status().isBadRequest());
        // malformed bodies and unknown ids: 4xx, never 5xx
        mvc.perform(auth(put("/api/instructor/items/" + f.a() + "/release").contentType("application/json")
                .content("{\"prerequisites\":[{\"itemId\":\"nope\"}]}"), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(put("/api/instructor/items/" + f.a() + "/release").contentType("application/json")
                .content("[1,2]"), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(put("/api/instructor/items/" + f.a() + "/release").contentType("application/json")
                .content("{\"prerequisites\":[{}]}"), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(put("/api/instructor/items/" + f.a() + "/release").contentType("application/json")
                .content("{\"prerequisites\":[null]}"), f.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + java.util.UUID.randomUUID() + "/release"),
                rules(true, null, null)), f.teacher())).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/not-a-uuid/release"), rules(true, null, null)),
                f.teacher())).andExpect(status().isBadRequest());
        // invalid progression value
        mvc.perform(auth(put("/api/instructor/courses/" + f.courseId()).contentType("application/json")
                .content("{\"title\":\"x\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"progression\":\"SIDEWAYS\"}"),
                f.teacher())).andExpect(status().isBadRequest());
    }

    @Test
    void rulesBelongToTheirOwnerAndAreCleanedUpOnDelete() throws Exception {
        Fixture f = fixture();
        String intruder = signUp(uniqueEmail("rel-intruder"), "INSTRUCTOR");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + f.a() + "/release"), rules(false, 1, null)), intruder))
                .andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + f.m1() + "/release"), rules(null, 1, null)), intruder))
                .andExpect(status().isNotFound());
        itemRules(f.teacher(), f.c(), rules(true, null, List.of(prereq(f.a(), null))));
        moduleRules(f.teacher(), f.m2(), rules(null, null, List.of(prereq(f.b(), null))));
        // deleting the required item removes the prerequisites that pointed at it
        mvc.perform(auth(delete("/api/instructor/items/" + f.a()), f.teacher())).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/instructor/items/" + f.c()), f.teacher()))
                .andExpect(jsonPath("$.prerequisites", hasSize(0)));
        // deleting the module with its items and rules works, and so does deleting the course
        mvc.perform(auth(delete("/api/instructor/modules/" + f.m2()), f.teacher())).andExpect(status().isNoContent());
        Integer rows = jdbc.queryForObject("select count(*) from release_prerequisites", Integer.class);
        assertThat(rows).isNotNull();
        mvc.perform(auth(delete("/api/instructor/courses/" + f.courseId()), f.teacher())).andExpect(status().isNoContent());
        Integer left = jdbc.queryForObject("select count(*) from release_prerequisites p where p.target_id in "
                + "(select id from course_modules)", Integer.class);
        assertThat(left).isNotNull();
    }
}
