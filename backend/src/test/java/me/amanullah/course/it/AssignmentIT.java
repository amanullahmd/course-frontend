package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
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
import java.util.UUID;
import me.amanullah.course.notification.MailService;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

/** Assignments: settings, submit, return, resubmit, grade, limits, late handling, permissions, notifications. */
class AssignmentIT extends PracticeTestSupport {

    @MockitoSpyBean
    MailService mail;

    private Map<String, Object> settings(Instant due, boolean allowLate, int points, int files, int submissions,
                                         boolean text) {
        Map<String, Object> m = new HashMap<>();
        m.put("dueAt", due == null ? null : due.toString());
        m.put("allowLate", allowLate);
        m.put("maxPoints", points);
        m.put("maxFiles", files);
        m.put("maxSubmissions", submissions);
        m.put("allowText", text);
        return m;
    }

    private void configure(Setup s, String item, Map<String, Object> settings) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + item + "/assignment"), settings), s.teacher()))
                .andExpect(status().isOk());
    }

    private MvcResult submit(String token, String item, String text, List<String> media) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("textAnswer", text);
        body.put("mediaIds", media);
        return mvc.perform(auth(jsonBody(post("/api/student/items/" + item + "/submissions"), body), token)).andReturn();
    }

    private Map<String, Object> review(String action, Double points, String feedback, List<String> media) {
        Map<String, Object> m = new HashMap<>();
        m.put("action", action);
        m.put("points", points);
        m.put("feedback", feedback);
        m.put("feedbackMediaIds", media);
        return m;
    }

    @Test
    void settingsValidationAndPermissions() throws Exception {
        Setup s = course();
        String task = item(s, "ASSIGNMENT", "Schreibaufgabe");
        String text = item(s, "TEXT", "Lektion");
        String other = signUp(uniqueEmail("as-other"), "INSTRUCTOR");
        String student = learner(s, "as-stud");
        String url = "/api/instructor/items/" + task + "/assignment";

        mvc.perform(auth(get(url), s.teacher())).andExpect(status().isOk()).andExpect(jsonPath("$.itemId").value(task))
                .andExpect(jsonPath("$.maxPoints").value(10)).andExpect(jsonPath("$.maxFiles").value(3))
                .andExpect(jsonPath("$.maxSubmissions").value(3)).andExpect(jsonPath("$.allowLate").value(true))
                .andExpect(jsonPath("$.allowText").value(true)).andExpect(jsonPath("$.dueAt").doesNotExist());
        Instant due = Instant.now().plus(Duration.ofDays(2));
        mvc.perform(auth(jsonBody(put(url), settings(due, false, 20, 2, 2, true)), s.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.maxPoints").value(20))
                .andExpect(jsonPath("$.allowLate").value(false)).andExpect(jsonPath("$.maxSubmissions").value(2));

        for (Map<String, Object> bad : List.of(settings(null, true, 0, 2, 2, true), settings(null, true, 10, 21, 2, true),
                settings(null, true, 10, 2, 0, true), settings(null, true, 1001, 2, 2, true))) {
            mvc.perform(auth(jsonBody(put(url), bad), s.teacher())).andExpect(status().isBadRequest());
        }
        mvc.perform(auth(jsonBody(put(url), settings(null, true, 10, 0, 2, false)), s.teacher()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.allowText").exists());
        mvc.perform(auth(jsonBody(put(url), Map.of("dueAt", "tomorrow")), s.teacher())).andExpect(status().isBadRequest());

        mvc.perform(auth(get("/api/instructor/items/" + text + "/assignment"), s.teacher()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
        mvc.perform(auth(get(url), other)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(put(url), settings(null, true, 10, 2, 2, true)), other)).andExpect(status().isNotFound());
        mvc.perform(auth(get(url), student)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions"), other)).andExpect(status().isNotFound());
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions"), student)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions?status=NOPE"), s.teacher()))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/instructor/courses/" + s.courseId() + "/submissions"), other)).andExpect(status().isNotFound());

        // the due date shows up in the instructor schedule
        mvc.perform(auth(get("/api/instructor/schedule?courseId=" + s.courseId()), s.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.action=='DUE')].title").value("Schreibaufgabe"))
                .andExpect(jsonPath("$[?(@.action=='DUE')].entityId").value(task));
    }

    @Test
    void submitReturnResubmitAndGrade() throws Exception {
        Setup s = course();
        String task = item(s, "ASSIGNMENT", "Schreibaufgabe");
        configure(s, task, settings(Instant.now().plus(Duration.ofDays(2)), true, 20, 2, 3, true));
        String annaEmail = uniqueEmail("as-anna");
        String anna = signUp(annaEmail, "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + s.courseId() + "/enrollments"), Map.of()), anna))
                .andExpect(status().isCreated());
        setLocale(annaEmail, "de");
        String ben = learner(s, "as-ben");
        String outsider = signUp(uniqueEmail("as-out"), "STUDENT");
        String view = "/api/student/items/" + task;

        mvc.perform(auth(get(view + "/assignment"), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmit").value(true)).andExpect(jsonPath("$.submitBlocked").doesNotExist())
                .andExpect(jsonPath("$.overdue").value(false)).andExpect(jsonPath("$.submissionsUsed").value(0))
                .andExpect(jsonPath("$.maxPoints").value(20));
        mvc.perform(auth(get(view), anna)).andExpect(jsonPath("$.completed").value(false));
        mvc.perform(auth(get(view + "/submissions"), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // ---- validation: nothing, too many files, foreign media, oversized text
        String f1 = upload(anna, "antwort.txt", "Mein Text");
        String f2 = upload(anna, "zweite.txt", "Noch einer");
        String f3 = upload(anna, "dritte.txt", "Zu viel");
        String benFile = upload(ben, "ben.txt", "Bens Datei");
        assertThat(submit(anna, task, "  ", List.of()).getResponse().getStatus()).isEqualTo(400);
        assertThat(submit(anna, task, null, null).getResponse().getStatus()).isEqualTo(400);
        MvcResult tooMany = submit(anna, task, "x", List.of(f1, f2, f3));
        assertThat(tooMany.getResponse().getStatus()).isEqualTo(400);
        assertThat((Object) read(tooMany, "$.errors.mediaIds")).isNotNull();
        MvcResult foreign = submit(anna, task, "x", List.of(benFile));
        assertThat(foreign.getResponse().getStatus()).isEqualTo(400);
        assertThat((Object) read(foreign, "$.errors['mediaIds[0]']")).isNotNull();
        assertThat(submit(anna, task, "x", List.of(UUID.randomUUID().toString())).getResponse().getStatus()).isEqualTo(400);
        assertThat(submit(anna, task, "x".repeat(20001), List.of()).getResponse().getStatus()).isEqualTo(400);
        assertThat(submit(outsider, task, "hi", List.of()).getResponse().getStatus()).isEqualTo(403);
        mvc.perform(auth(get(view + "/submissions"), outsider)).andExpect(status().isForbidden());
        mvc.perform(auth(get(view + "/assignment"), outsider)).andExpect(status().isForbidden());

        // ---- version 1
        MvcResult v1 = submit(anna, task, "Hallo, ich heiße Anna.", List.of(f1, f1, f2));
        assertThat(v1.getResponse().getStatus()).isEqualTo(201);
        assertThat((Integer) read(v1, "$.versionNo")).isEqualTo(1);
        assertThat((String) read(v1, "$.status")).isEqualTo("SUBMITTED");
        assertThat((Boolean) read(v1, "$.late")).isFalse();
        assertThat((Integer) read(v1, "$.files.length()")).isEqualTo(2); // duplicates collapsed
        assertThat((String) read(v1, "$.files[0].media.fileName")).isEqualTo("antwort.txt");
        assertThat((Object) read(v1, "$.points")).isNull();
        String sub1 = read(v1, "$.id");
        mvc.perform(auth(get(view), anna)).andExpect(jsonPath("$.completed").value(true));
        mvc.perform(auth(get(view + "/assignment"), anna)).andExpect(jsonPath("$.canSubmit").value(false))
                .andExpect(jsonPath("$.submitBlocked").value("UNDER_REVIEW")).andExpect(jsonPath("$.submissionsUsed").value(1));
        assertThat(submit(anna, task, "noch einmal", List.of()).getResponse().getStatus()).isEqualTo(409);
        mvc.perform(auth(get("/api/notifications"), s.teacher())).andExpect(jsonPath("$.content[0].type")
                        .value("ASSIGNMENT_SUBMITTED"))
                .andExpect(jsonPath("$.content[0].link").value("/instructor/courses/" + s.courseId() + "/submissions?submission=" + sub1));

        // ---- learners only see their own versions
        mvc.perform(auth(get(view + "/submissions"), ben)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(auth(get(view + "/submissions"), anna)).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(auth(get("/api/instructor/submissions/" + sub1), ben)).andExpect(status().isForbidden());
        String other = signUp(uniqueEmail("as-other2"), "INSTRUCTOR");
        mvc.perform(auth(get("/api/instructor/submissions/" + sub1), other)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("GRADE", 5.0, "x", List.of())), other)).andExpect(status().isNotFound());

        // ---- instructor queue
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(sub1))
                .andExpect(jsonPath("$[0].student.fullName").value("Test STUDENT"))
                .andExpect(jsonPath("$[0].fileCount").value(2)).andExpect(jsonPath("$[0].hasText").value(true))
                .andExpect(jsonPath("$[0].maxPoints").value(20));
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions?status=GRADED"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(auth(get("/api/instructor/courses/" + s.courseId() + "/submissions?status=SUBMITTED"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].itemTitle").value("Schreibaufgabe"));
        mvc.perform(auth(get("/api/instructor/submissions/" + sub1), s.teacher())).andExpect(status().isOk())
                .andExpect(jsonPath("$.current.textAnswer").value("Hallo, ich heiße Anna."))
                .andExpect(jsonPath("$.current.files[1].media.downloadUrl").exists())
                .andExpect(jsonPath("$.latest").value(true)).andExpect(jsonPath("$.history.length()").value(1));

        // ---- return for revision: needs feedback, points must fit, notification + e-mail in the learner's language
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("RETURN", null, "<p> </p>", List.of())), s.teacher())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.feedback").exists());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("RETURN", 25.0, "zu viel", List.of())), s.teacher())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.points").exists());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("GRADE", null, "ok", List.of())), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("GRADE", -1.0, "ok", List.of())), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("ARCHIVE", 1.0, "ok", List.of())), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("RETURN", null, "x", List.of(UUID.randomUUID().toString()))), s.teacher()))
                .andExpect(status().isBadRequest());
        String feedbackFile = upload(s.teacher(), "korrektur.txt", "Korrekturen");
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                        review("RETURN", 8.0, "<p>Bitte <b>ergänze</b> Hobbys.<script>alert(1)</script></p>",
                                List.of(feedbackFile))), s.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.current.status").value("RETURNED"))
                .andExpect(jsonPath("$.current.feedback").value("<p>Bitte <b>ergänze</b> Hobbys.</p>"))
                .andExpect(jsonPath("$.current.files.length()").value(3))
                .andExpect(jsonPath("$.current.files[2].feedbackFile").value(true));
        mvc.perform(auth(get("/api/notifications"), anna)).andExpect(jsonPath("$.content[0].type").value("ASSIGNMENT_REVIEWED"))
                .andExpect(jsonPath("$.content[0].title").value("Bitte überarbeite deine Abgabe"))
                .andExpect(jsonPath("$.content[0].link").value("/learn/" + s.courseId() + "/" + task + "?submission=" + sub1));
        verify(mail).send(eq(annaEmail), argThat(m -> m.subject().equals("Bitte überarbeite deine Abgabe „Schreibaufgabe“")
                && m.text().contains("?submission=" + sub1)));
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("GRADE", 10.0, "x", List.of())), s.teacher())).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SUBMISSION_RETURNED"));

        // the learner sees feedback, the points and the instructor's file
        mvc.perform(auth(get(view + "/submissions"), anna)).andExpect(jsonPath("$[0].status").value("RETURNED"))
                .andExpect(jsonPath("$[0].points").value(8.0)).andExpect(jsonPath("$[0].feedback").exists())
                .andExpect(jsonPath("$[0].files[2].feedbackFile").value(true));
        mvc.perform(auth(get(view + "/assignment"), anna)).andExpect(jsonPath("$.canSubmit").value(true));

        // ---- version 2, then grading
        MvcResult v2 = submit(anna, task, "Ich heiße Anna und tanze gern.", List.of(f1));
        assertThat(v2.getResponse().getStatus()).isEqualTo(201);
        assertThat((Integer) read(v2, "$.versionNo")).isEqualTo(2);
        String sub2 = read(v2, "$.id");
        // a submitted version hides points/feedback from the learner while the previous version keeps them
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(sub2))
                .andExpect(jsonPath("$[0].versionNo").value(2));
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub1 + "/review"),
                review("GRADE", 10.0, "x", List.of())), s.teacher())).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SUBMISSION_SUPERSEDED"));
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub2 + "/review"),
                        review("GRADE", 17.5, "<p>Sehr gut!</p>", List.of())), s.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.current.status").value("GRADED"))
                .andExpect(jsonPath("$.current.points").value(17.5)).andExpect(jsonPath("$.history.length()").value(2));
        mvc.perform(auth(get("/api/notifications"), anna)).andExpect(jsonPath("$.content[0].title").value("Abgabe bewertet"));
        verify(mail).send(eq(annaEmail), argThat(m -> m.subject().equals("Deine Abgabe „Schreibaufgabe“ wurde bewertet")));
        mvc.perform(auth(get(view + "/assignment"), anna)).andExpect(jsonPath("$.submitBlocked").value("GRADED"));
        assertThat(submit(anna, task, "nochmal", List.of()).getResponse().getStatus()).isEqualTo(409);
        // regrading is possible
        mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + sub2 + "/review"),
                review("GRADE", 18.0, null, List.of())), s.teacher())).andExpect(status().isOk())
                .andExpect(jsonPath("$.current.points").value(18.0)).andExpect(jsonPath("$.current.feedback").doesNotExist());
        mvc.perform(auth(get("/api/instructor/items/" + task + "/submissions?status=GRADED"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void submissionLimitAndDeadlines() throws Exception {
        Setup s = course();
        String limited = item(s, "ASSIGNMENT", "Begrenzt");
        configure(s, limited, settings(null, true, 10, 1, 2, true));
        String ben = learner(s, "as-lim");
        for (int round = 1; round <= 2; round++) {
            MvcResult r = submit(ben, limited, "Version " + round, List.of());
            assertThat(r.getResponse().getStatus()).isEqualTo(201);
            mvc.perform(auth(jsonBody(post("/api/instructor/submissions/" + read(r, "$.id") + "/review"),
                    review("RETURN", null, "Nochmal bitte", List.of())), s.teacher())).andExpect(status().isOk());
        }
        mvc.perform(auth(get("/api/student/items/" + limited + "/assignment"), ben))
                .andExpect(jsonPath("$.submitBlocked").value("MAX_SUBMISSIONS")).andExpect(jsonPath("$.canSubmit").value(false));
        MvcResult third = submit(ben, limited, "Version 3", List.of());
        assertThat(third.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(third, "$.code")).isEqualTo("SUBMISSION_MAX_SUBMISSIONS");

        // text-only forbidden / files-only
        String filesOnly = item(s, "ASSIGNMENT", "Nur Dateien");
        configure(s, filesOnly, settings(null, true, 10, 2, 3, false));
        assertThat(submit(ben, filesOnly, "Text", List.of()).getResponse().getStatus()).isEqualTo(400);
        String file = upload(ben, "scan.txt", "Scan");
        assertThat(submit(ben, filesOnly, null, List.of(file)).getResponse().getStatus()).isEqualTo(201);

        // late: flagged when allowed, rejected when not
        String lateOk = item(s, "ASSIGNMENT", "Spät erlaubt");
        configure(s, lateOk, settings(Instant.now().minus(Duration.ofHours(2)), true, 10, 1, 3, true));
        mvc.perform(auth(get("/api/student/items/" + lateOk + "/assignment"), ben))
                .andExpect(jsonPath("$.overdue").value(true)).andExpect(jsonPath("$.canSubmit").value(true));
        MvcResult late = submit(ben, lateOk, "Zu spät", List.of());
        assertThat(late.getResponse().getStatus()).isEqualTo(201);
        assertThat((Boolean) read(late, "$.late")).isTrue();
        mvc.perform(auth(get("/api/instructor/items/" + lateOk + "/submissions"), s.teacher()))
                .andExpect(jsonPath("$[0].late").value(true));
        String closed = item(s, "ASSIGNMENT", "Geschlossen");
        configure(s, closed, settings(Instant.now().minus(Duration.ofHours(2)), false, 10, 1, 3, true));
        mvc.perform(auth(get("/api/student/items/" + closed + "/assignment"), ben))
                .andExpect(jsonPath("$.submitBlocked").value("CLOSED"));
        MvcResult rejected = submit(ben, closed, "Zu spät", List.of());
        assertThat(rejected.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(rejected, "$.code")).isEqualTo("SUBMISSION_CLOSED");
        mvc.perform(auth(get("/api/student/items/" + closed), ben)).andExpect(jsonPath("$.completed").value(false));

        // not an assignment / unknown items / hidden items
        String text = item(s, "TEXT", "Lektion");
        mvc.perform(auth(get("/api/student/items/" + text + "/assignment"), ben)).andExpect(status().isNotFound());
        assertThat(submit(ben, text, "x", List.of()).getResponse().getStatus()).isEqualTo(404);
        assertThat(submit(ben, UUID.randomUUID().toString(), "x", List.of()).getResponse().getStatus()).isEqualTo(404);
        Map<String, Object> draft = new HashMap<>();
        draft.put("publishStatus", "DRAFT");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + limited + "/publication"), draft), s.teacher()))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/items/" + limited + "/submissions"), ben)).andExpect(status().isNotFound());
        verify(mail, org.mockito.Mockito.atLeastOnce()).send(any(), any());
    }
}
