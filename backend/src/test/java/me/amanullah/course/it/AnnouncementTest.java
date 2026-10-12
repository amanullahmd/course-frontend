package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import me.amanullah.course.announcement.AnnouncementScheduler;
import me.amanullah.course.notification.MailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** Course announcements: drafts, validation, sending, scheduling, audiences, read tracking, e-mails, access. */
class AnnouncementTest extends CommunicationTestSupport {

    @MockitoSpyBean
    MailService mail;

    @Autowired
    AnnouncementScheduler scheduler;

    private static Map<String, Object> upsert(String title, String body, String audience, List<String> recipients,
                                              boolean email, boolean pinned, String status, Instant scheduledAt) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("body", body);
        m.put("audience", audience);
        m.put("recipientIds", recipients);
        m.put("sendEmail", email);
        m.put("pinned", pinned);
        m.put("status", status);
        m.put("scheduledAt", scheduledAt == null ? null : scheduledAt.toString());
        return m;
    }

    @Test
    void createSendScheduleAndReadAnnouncements() throws Exception {
        String teacher = signUp(uniqueEmail("ann-teacher"), "INSTRUCTOR");
        String other = signUp(uniqueEmail("ann-other"), "INSTRUCTOR");
        String e1 = uniqueEmail("ann-s1");
        String e2 = uniqueEmail("ann-s2");
        String e3 = uniqueEmail("ann-s3");
        String e4 = uniqueEmail("ann-s4");
        String s1 = signUp(e1, "STUDENT");
        String s2 = signUp(e2, "STUDENT");
        String s3 = signUp(e3, "STUDENT");
        String s4 = signUp(e4, "STUDENT");
        setLocale(e1, "de");
        String courseId = liveCourse(teacher, "Deutsch im Alltag", "APPROVAL");
        approve(teacher, apply(s1, courseId));
        approve(teacher, apply(s2, courseId));
        apply(s3, courseId); // stays PENDING
        String base = "/api/instructor/courses/" + courseId + "/announcements";

        // ---- draft, sanitized body, projected recipient count ----
        String id = read(mvc.perform(auth(jsonBody(post(base), upsert("Kein Unterricht am Montag",
                        "<p>Hallo <script>alert(1)</script><b>zusammen</b>!</p>", "ALL_APPROVED", null, true, false,
                        null, null)), teacher))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.body").value("<p>Hallo <b>zusammen</b>!</p>"))
                .andExpect(jsonPath("$.recipientCount").value(2))
                .andExpect(jsonPath("$.sentAt").doesNotExist())
                .andReturn(), "$.id");
        mvc.perform(auth(get(base), teacher)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(id));

        // ---- ownership and roles ----
        mvc.perform(auth(get("/api/instructor/announcements/" + id), other))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ANNOUNCEMENT_NOT_FOUND"));
        mvc.perform(auth(post("/api/instructor/announcements/" + id + "/send"), other))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get(base), other)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        mvc.perform(auth(get(base), s1)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(auth(jsonBody(post(base), upsert("x", "<p>x</p>", "ALL_APPROVED", null, false, false, null,
                null)), s1)).andExpect(status().isForbidden());

        // ---- validation ----
        mvc.perform(auth(jsonBody(post(base), upsert("Später", "<p>x</p>", "ALL_APPROVED", null, false, false,
                        "SCHEDULED", null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.scheduledAt").exists());
        mvc.perform(auth(jsonBody(post(base), upsert("Später", "<p>x</p>", "ALL_APPROVED", null, false, false,
                        "SCHEDULED", Instant.now().minusSeconds(60))), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.scheduledAt").exists());
        mvc.perform(auth(jsonBody(post(base), upsert("Sofort", "<p>x</p>", "ALL_APPROVED", null, false, false,
                        "SENT", null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.status").exists());
        mvc.perform(auth(jsonBody(post(base), upsert("Auswahl", "<p>x</p>", "SELECTED", List.of(), false, false,
                        null, null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.recipientIds").exists());
        // a pending learner, an unrelated user and an unknown id are not approved learners of the course
        for (String bad : List.of(userId(e3), userId(e4), randomId())) {
            mvc.perform(auth(jsonBody(post(base), upsert("Auswahl", "<p>x</p>", "SELECTED", List.of(bad), false,
                            false, null, null)), teacher))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.errors.recipientIds").exists());
        }
        mvc.perform(auth(jsonBody(post(base), upsert("Leer", "<script>alert(1)</script>", "ALL_APPROVED", null,
                        false, false, null, null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.body").exists());
        mvc.perform(auth(jsonBody(post(base), upsert("x".repeat(201), "<p>x</p>", "ALL_APPROVED", null, false,
                        false, null, null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.title").exists());
        mvc.perform(auth(jsonBody(post(base), upsert("Lang", "<p>" + "a".repeat(20_001) + "</p>", "ALL_APPROVED",
                        null, false, false, null, null)), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.body").exists());

        // ---- send now: only approved learners, notifications + e-mails in the recipient's language ----
        clearInvocations(mail);
        mvc.perform(auth(post("/api/instructor/announcements/" + id + "/send"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SENT"))
                .andExpect(jsonPath("$.sentAt").isNotEmpty())
                .andExpect(jsonPath("$.recipientCount").value(2))
                .andExpect(jsonPath("$.readCount").value(0));
        verify(mail).send(eq(e1), argThat(m -> m.subject().equals("[Deutsch im Alltag] Kein Unterricht am Montag")
                && m.text().contains("hat eine Ankündigung in „Deutsch im Alltag“ veröffentlicht")
                && m.html().contains("<b>zusammen</b>") && !m.html().contains("<script")
                && m.text().contains("/learn/" + courseId + "/announcements")));
        verify(mail).send(eq(e2), argThat(m -> m.text().contains("posted an announcement in \"Deutsch im Alltag\"")));
        verify(mail, never()).send(eq(e3), any());
        verify(mail, never()).send(eq(e4), any());
        mvc.perform(auth(get("/api/notifications"), s1))
                .andExpect(jsonPath("$.content[0].type").value("ANNOUNCEMENT"))
                .andExpect(jsonPath("$.content[0].title").value("Neue Ankündigung: Kein Unterricht am Montag"))
                .andExpect(jsonPath("$.content[0].link").value("/learn/" + courseId + "/announcements"));
        mvc.perform(auth(get("/api/notifications"), s3))
                .andExpect(jsonPath("$.content[?(@.type == 'ANNOUNCEMENT')]").isEmpty());
        mvc.perform(auth(post("/api/instructor/announcements/" + id + "/send"), teacher))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATUS"));

        // ---- selected audience, pinned, without e-mail ----
        clearInvocations(mail);
        String selected = read(mvc.perform(auth(jsonBody(post(base), upsert("Nur für dich", "<p>Hausaufgabe</p>",
                        "SELECTED", List.of(userId(e2)), false, true, null, null)), teacher))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.recipientCount").value(1)).andReturn(), "$.id");
        mvc.perform(auth(post("/api/instructor/announcements/" + selected + "/send"), teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recipientCount").value(1));
        verify(mail, never()).send(any(), any());

        // ---- learner feeds: only their own, pinned first ----
        String feed = "/api/student/courses/" + courseId + "/announcements";
        mvc.perform(auth(get(feed), s1)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].read").value(false))
                .andExpect(jsonPath("$[0].author.fullName").value("Test INSTRUCTOR"));
        mvc.perform(auth(get(feed), s2)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(selected))
                .andExpect(jsonPath("$[0].pinned").value(true))
                .andExpect(jsonPath("$[1].id").value(id));
        mvc.perform(auth(get(feed), s3)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
        mvc.perform(auth(get(feed), s4)).andExpect(status().isForbidden());
        mvc.perform(auth(get(feed), teacher)).andExpect(status().isOk()) // owner preview: every sent one
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(auth(get("/api/student/announcements/unread"), s2))
                .andExpect(jsonPath("$[0].courseId").value(courseId)).andExpect(jsonPath("$[0].count").value(2));

        // ---- read tracking ----
        mvc.perform(auth(post("/api/student/announcements/" + id + "/read"), s1)).andExpect(status().isNoContent());
        mvc.perform(auth(post("/api/student/announcements/" + id + "/read"), s1)).andExpect(status().isNoContent());
        mvc.perform(auth(post("/api/student/announcements/" + selected + "/read"), s1))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ANNOUNCEMENT_NOT_FOUND"));
        mvc.perform(auth(get(feed), s1)).andExpect(jsonPath("$[0].read").value(true));
        mvc.perform(auth(get("/api/student/announcements/unread"), s1)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(auth(get("/api/instructor/announcements/" + id), teacher))
                .andExpect(jsonPath("$.readCount").value(1)).andExpect(jsonPath("$.readPercent").value(50));

        // ---- editing a sent announcement changes content only and does not notify again ----
        clearInvocations(mail);
        long notificationsBefore = notificationCount(e1);
        mvc.perform(auth(jsonBody(put("/api/instructor/announcements/" + id), upsert("Kein Unterricht am Dienstag",
                        "<p>Korrektur</p>", "SELECTED", List.of(userId(e2)), true, true, "DRAFT", null)), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SENT"))
                .andExpect(jsonPath("$.title").value("Kein Unterricht am Dienstag"))
                .andExpect(jsonPath("$.audience").value("ALL_APPROVED"))
                .andExpect(jsonPath("$.pinned").value(true))
                .andExpect(jsonPath("$.recipientCount").value(2));
        verify(mail, never()).send(any(), any());
        assertThat(notificationCount(e1)).isEqualTo(notificationsBefore);

        // ---- scheduling: sent by the job once due ----
        Instant inOneHour = Instant.now().plus(1, ChronoUnit.HOURS);
        String scheduled = read(mvc.perform(auth(jsonBody(post(base), upsert("Test nächste Woche", "<p>Viel Erfolg</p>",
                        "ALL_APPROVED", null, true, false, "SCHEDULED", inOneHour)), teacher))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.scheduledAt").isNotEmpty())
                .andReturn(), "$.id");
        scheduler.sendDue(Instant.now());
        mvc.perform(auth(get("/api/instructor/announcements/" + scheduled), teacher))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
        assertThat(scheduler.sendDue(inOneHour.plusSeconds(60))).isGreaterThanOrEqualTo(1);
        mvc.perform(auth(get("/api/instructor/announcements/" + scheduled), teacher))
                .andExpect(jsonPath("$.status").value("SENT"))
                .andExpect(jsonPath("$.scheduledAt").doesNotExist())
                .andExpect(jsonPath("$.recipientCount").value(2));
        verify(mail).send(eq(e1), argThat(m -> m.subject().equals("[Deutsch im Alltag] Test nächste Woche")));
        assertThat(scheduler.sendDue(inOneHour.plusSeconds(120))).isZero();

        // ---- delete ----
        mvc.perform(auth(delete("/api/instructor/announcements/" + scheduled), other)).andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/instructor/announcements/" + scheduled), teacher))
                .andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/instructor/announcements/" + scheduled), teacher)).andExpect(status().isNotFound());
        mvc.perform(auth(get(feed), s1)).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void sendingWithoutRecipientsIsRejectedAndAdminsManageEverything() throws Exception {
        String teacher = signUp(uniqueEmail("ann-empty"), "INSTRUCTOR");
        String admin = admin(uniqueEmail("ann-admin"));
        String courseId = liveCourse(teacher, "Leerer Kurs", "OPEN");
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/announcements"),
                        upsert("Hallo", "<p>Willkommen</p>", "ALL_APPROVED", null, false, false, null, null)), admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recipientCount").value(0))
                .andReturn(), "$.id");
        mvc.perform(auth(post("/api/instructor/announcements/" + id + "/send"), teacher))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_RECIPIENTS"));
        mvc.perform(auth(get("/api/instructor/announcements/" + id), teacher))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        // an OPEN course: joining approves immediately; then sending works
        String student = signUp(uniqueEmail("ann-joiner"), "STUDENT");
        apply(student, courseId);
        mvc.perform(auth(post("/api/instructor/announcements/" + id + "/send"), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recipientCount").value(1));
        mvc.perform(auth(get("/api/student/courses/" + courseId + "/announcements"), student))
                .andExpect(jsonPath("$[0].title").value("Hallo"))
                .andExpect(jsonPath("$[0].body", containsString("Willkommen")));
    }

    private long notificationCount(String email) {
        return tx.execute(s -> {
            var u = users.findByEmailIgnoreCase(email).orElseThrow();
            return notifications.findByUserId(u.getId(), org.springframework.data.domain.Pageable.unpaged())
                    .getTotalElements();
        });
    }

    @Autowired
    me.amanullah.course.notification.NotificationRepository notifications;
}
