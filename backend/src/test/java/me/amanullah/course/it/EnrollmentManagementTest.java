package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.MailService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultMatcher;

/** Bulk removal, restoring access and adding learners by e-mail (instructor students tab). */
class EnrollmentManagementTest extends IntegrationTestSupport {

    @MockitoSpyBean
    MailService mail;

    @Test
    void addBulkRemoveAndRestore() throws Exception {
        String teacherEmail = uniqueEmail("teacher");
        String teacher = signUp(teacherEmail, "INSTRUCTOR");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(teacherEmail).orElseThrow().setLocale("de"));
        String otherTeacher = signUp(uniqueEmail("other-teacher"), "INSTRUCTOR");
        String s1 = uniqueEmail("s1");
        String s2 = uniqueEmail("s2");
        String s3 = uniqueEmail("s3");
        String s4 = uniqueEmail("s4");
        String s1Token = signUp(s1, "STUDENT");
        String s2Token = signUp(s2, "STUDENT");
        signUp(s3, "STUDENT");
        String s4Token = signUp(s4, "STUDENT");
        String unverified = uniqueEmail("unverified");
        mvc.perform(jsonBody(post("/api/auth/register"),
                Map.of("fullName", "Uwe", "email", unverified, "password", PASSWORD, "role", "STUDENT")))
                .andExpect(status().isCreated());
        String disabled = uniqueEmail("disabled");
        signUp(disabled, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(disabled).orElseThrow().setEnabled(false));
        String unknown1 = uniqueEmail("nobody");
        String unknown2 = uniqueEmail("nobody2");

        MvcResult created = mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                        "title", "Deutsch kompakt", "subtitle", "A2", "description", "<p>Hallo</p>", "level", "A2",
                        "tags", List.of(), "enrollmentMode", "APPROVAL", "capacity", 3)), teacher))
                .andExpect(status().isCreated()).andReturn();
        String courseId = read(created, "$.id");
        String slug = read(created, "$.slug");
        String addUrl = "/api/instructor/courses/" + courseId + "/enrollments/add";

        // ---- add one learner ----
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(s1))), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added.length()").value(1))
                .andExpect(jsonPath("$.added[0].status").value("APPROVED"))
                .andExpect(jsonPath("$.added[0].decisionReason").value("Added by instructor"))
                .andExpect(jsonPath("$.added[0].decidedAt").isNotEmpty())
                .andExpect(jsonPath("$.invited.length()").value(0));
        verify(mail).send(eq(s1), argThat(subject("You have been added to \"Deutsch kompakt\"")));
        mvc.perform(auth(get("/api/notifications"), s1Token))
                .andExpect(jsonPath("$.content[0].title").value("Added to a course"))
                .andExpect(jsonPath("$.content[0].link").value("/learn/" + courseId));

        // ---- every outcome in one request: duplicates, capacity, unverified, disabled, owner, unknown + invite ----
        List<String> emails = List.of("  " + s1.toUpperCase() + " ", s2, s2.toUpperCase(), s3, s4, unverified, disabled,
                teacherEmail, unknown1, unknown2);
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", emails, "message", "Willkommen im Kurs!",
                        "invite", true)), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added.length()").value(2))
                .andExpect(jsonPath("$.added[0].student.email").value(s2))
                .andExpect(jsonPath("$.added[1].student.email").value(s3))
                .andExpect(jsonPath("$.alreadyEnrolled", contains(s1)))
                .andExpect(jsonPath("$.notFound", contains(unknown1, unknown2)))
                .andExpect(jsonPath("$.invited", contains(unknown1, unknown2)))
                .andExpect(jsonPath("$.skipped.length()").value(4))
                .andExpect(skipped(s4, "CAPACITY_REACHED"))
                .andExpect(skipped(unverified, "EMAIL_NOT_VERIFIED"))
                .andExpect(skipped(disabled, "ACCOUNT_DISABLED"))
                .andExpect(skipped(teacherEmail, "OWN_COURSE"));
        // the invitation uses the instructor's language, names the course and links to the registration
        verify(mail).send(eq(unknown1), argThat(m -> m.subject().equals("Test INSTRUCTOR lädt dich zu „Deutsch kompakt“ auf Sprachweg ein")
                && m.text().contains("Nachricht von Test INSTRUCTOR: „Willkommen im Kurs!“")
                && m.text().contains("/register?email=" + unknown1.replace("@", "%40") + "&next=%2Fcourses%2F" + slug)));
        verify(mail).send(eq(s2), argThat(m -> m.text().contains("Willkommen im Kurs!")));
        verify(mail, never()).send(eq(s4), argThat(m -> true));

        // the same address is not invited twice within 24 hours
        clearInvocations(mail);
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(unknown1), "invite", true)), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notFound", contains(unknown1)))
                .andExpect(jsonPath("$.invited.length()").value(0))
                .andExpect(skipped(unknown1, "ALREADY_INVITED"));
        verify(mail, never()).send(eq(unknown1), argThat(m -> true));
        // without invite, unknown addresses are only reported
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(unknown2))), teacher))
                .andExpect(jsonPath("$.notFound", contains(unknown2)))
                .andExpect(jsonPath("$.invited.length()").value(0))
                .andExpect(jsonPath("$.skipped.length()").value(0));

        Map<String, String> ids = enrollmentIds(courseId, teacher);
        assertThat(ids).containsOnlyKeys(s1, s2, s3);

        // ---- bulk remove (all or nothing) ----
        clearInvocations(mail);
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids",
                        List.of(ids.get(s1), ids.get(s2)), "action", "REVOKE", "reason", "Kurs beendet",
                        "courseId", courseId)), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].status").value("REVOKED"))
                .andExpect(jsonPath("$[1].status").value("REVOKED"))
                .andExpect(jsonPath("$[0].decisionReason").value("Kurs beendet"));
        verify(mail).send(eq(s1), argThat(subject("Access to \"Deutsch kompakt\" ended")));
        verify(mail).send(eq(s2), argThat(subject("Access to \"Deutsch kompakt\" ended")));
        mvc.perform(auth(get("/api/notifications"), s2Token))
                .andExpect(jsonPath("$.content[0].title").value("Access ended"))
                .andExpect(jsonPath("$.content[0].body").value("Your access to \"Deutsch kompakt\" has ended. Reason: Kurs beendet"));
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/enrollment"), s1Token))
                .andExpect(jsonPath("$.status").value("REVOKED"));

        // one removed learner in the selection → nothing changes
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids",
                        List.of(ids.get(s3), ids.get(s1)), "action", "REVOKE")), teacher))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"))
                .andExpect(jsonPath("$.detail").value("Only approved learners can be removed from the course."));
        assertThat(statusOf(courseId, teacher, s3)).isEqualTo("APPROVED");

        // ---- restore access (single approve of a REVOKED enrollment) ----
        clearInvocations(mail);
        mvc.perform(auth(post("/api/instructor/enrollments/" + ids.get(s1) + "/approve"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.decisionReason").doesNotExist());
        verify(mail).send(eq(s1), argThat(subject("Your access to \"Deutsch kompakt\" is back")));
        mvc.perform(auth(get("/api/notifications"), s1Token))
                .andExpect(jsonPath("$.content[0].title").value("Access restored"));

        // capacity 3: s1 + s3 approved, s4 added → full; restoring s2 must fail without changes
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(s4))), teacher))
                .andExpect(jsonPath("$.added.length()").value(1));
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s2)),
                        "action", "APPROVE")), teacher))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CAPACITY_REACHED"))
                .andExpect(jsonPath("$.detail").value("Not enough free seats: 1 selected, 0 left."));
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(s2))), teacher))
                .andExpect(jsonPath("$.added.length()").value(0))
                .andExpect(skipped(s2, "CAPACITY_REACHED"));
        assertThat(statusOf(courseId, teacher, s2)).isEqualTo("REVOKED");

        // a learner who withdrew can be restored too (bulk APPROVE) once there is a free seat
        String s4Enrollment = enrollmentIds(courseId, teacher).get(s4);
        mvc.perform(auth(post("/api/student/enrollments/" + s4Enrollment + "/withdraw"), s4Token))
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s2), s4Enrollment),
                        "action", "APPROVE")), teacher))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Not enough free seats: 2 selected, 1 left."));
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(s4Enrollment),
                        "action", "APPROVE", "courseId", courseId)), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("APPROVED"));
        // German message for a German instructor request
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s2)),
                        "action", "APPROVE")), teacher).header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(jsonPath("$.detail").value("Nicht genug freie Plätze: 1 ausgewählt, 0 frei."));

        // ---- ids of another course are refused when courseId is given ----
        String otherCourseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                        "title", "Zweiter Kurs", "level", "A1", "tags", List.of(), "enrollmentMode", "APPROVAL")), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s3)),
                        "action", "REVOKE", "courseId", otherCourseId)), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors['ids[0]']").value("contains an enrollment of another course"));
        assertThat(statusOf(courseId, teacher, s3)).isEqualTo("APPROVED");

        // ---- access control ----
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(s2))), otherTeacher))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of(s2))), s1Token))
                .andExpect(status().isForbidden());
        mvc.perform(jsonBody(post(addUrl), Map.of("emails", List.of(s2)))).andExpect(status().isUnauthorized());
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s3)),
                        "action", "REVOKE")), otherTeacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s3)),
                        "action", "REVOKE", "courseId", courseId)), otherTeacher))
                .andExpect(status().isNotFound());
        assertThat(statusOf(courseId, teacher, s3)).isEqualTo("APPROVED");

        // ---- validation: per-index errors, sizes, bad JSON; never a 5xx ----
        List<String> mixed = new ArrayList<>(List.of(s2, "not-an-email", "   ", "a@b", "x,y@z.de"));
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", mixed)), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors['emails[0]']").doesNotExist())
                .andExpect(jsonPath("$.errors['emails[1]']").value("must be a valid e-mail address"))
                .andExpect(jsonPath("$.errors['emails[2]']").value("is required"))
                .andExpect(jsonPath("$.errors['emails[3]']").value("must be a valid e-mail address"))
                .andExpect(jsonPath("$.errors['emails[4]']").value("must be a valid e-mail address"));
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", List.of("kaputt"))), teacher)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(jsonPath("$.errors['emails[0]']").value("muss eine gültige E-Mail-Adresse sein"));
        List<String> tooMany = new ArrayList<>();
        for (int i = 0; i < 201; i++) {
            tooMany.add("u" + i + "@example.org");
        }
        mvc.perform(auth(jsonBody(post(addUrl), Map.of("emails", tooMany)), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.emails").exists());
        Map<String, Object> nullEntry = new HashMap<>();
        nullEntry.put("emails", java.util.Arrays.asList(s2, null));
        List<Object[]> bad = List.of(
                new Object[] {Map.of("emails", List.of()), "VALIDATION_FAILED"},
                new Object[] {Map.of(), "VALIDATION_FAILED"},
                new Object[] {nullEntry, "VALIDATION_FAILED"},
                new Object[] {Map.of("emails", List.of(s2), "message", "x".repeat(2001)), "VALIDATION_FAILED"},
                new Object[] {"{\"emails\":\"" + s2 + "\"}", null},
                new Object[] {"{\"emails\":[{}]}", "MALFORMED_REQUEST"},
                new Object[] {"{\"emails\":[\"" + s2 + "\"],\"invite\":\"maybe\"}", "MALFORMED_REQUEST"},
                new Object[] {"{\"emails\":[", "MALFORMED_REQUEST"},
                new Object[] {"", "MALFORMED_REQUEST"});
        for (Object[] b : bad) {
            String body = b[0] instanceof String raw ? raw : json(b[0]);
            MvcResult r = mvc.perform(auth(post(addUrl).contentType(MediaType.APPLICATION_JSON).content(body), teacher))
                    .andReturn();
            assertThat(r.getResponse().getStatus()).as(body).isEqualTo(400);
            if (b[1] != null) {
                assertThat((String) read(r, "$.code")).as(body).isEqualTo(b[1]);
            }
        }
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/not-a-uuid/enrollments/add"),
                        Map.of("emails", List.of(s2))), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + java.util.UUID.randomUUID() + "/enrollments/add"),
                        Map.of("emails", List.of(s2))), teacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post("/api/instructor/enrollments/bulk"), Map.of("ids", List.of(ids.get(s3)),
                        "action", "DELETE")), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        verify(mail, atLeastOnce()).send(eq(s4), argThat(m -> true));
    }

    private static ArgumentMatcher<EmailTemplates.Email> subject(String subject) {
        return m -> m.subject().equals(subject);
    }

    private static ResultMatcher skipped(String email, String code) {
        return jsonPath("$.skipped[?(@.email == '" + email + "')].code", hasItem(code));
    }

    /** student e-mail → enrollment id. */
    private Map<String, String> enrollmentIds(String courseId, String token) throws Exception {
        MvcResult r = mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/enrollments"), token))
                .andExpect(status().isOk()).andReturn();
        List<String> emails = read(r, "$[*].student.email");
        List<String> idList = read(r, "$[*].id");
        Map<String, String> result = new HashMap<>();
        for (int i = 0; i < emails.size(); i++) {
            result.put(emails.get(i), idList.get(i));
        }
        return result;
    }

    private String statusOf(String courseId, String token, String email) throws Exception {
        MvcResult r = mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/enrollments"), token))
                .andExpect(status().isOk()).andReturn();
        List<String> statuses = read(r, "$[?(@.student.email == '" + email + "')].status");
        assertThat(statuses).hasSize(1);
        return statuses.getFirst();
    }
}
