package me.amanullah.course.it;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import me.amanullah.course.messaging.MessageMailJob;
import me.amanullah.course.messaging.MessageRateLimiter;
import me.amanullah.course.notification.MailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;

/** Direct messages: permission rules, conversation reuse, paging, unread counts, rate limit, e-mail throttling. */
class MessagingTest extends CommunicationTestSupport {

    @MockitoSpyBean
    MailService mail;

    @Autowired
    MessageMailJob mailJob;

    private ResultActions start(String token, String recipientId, String courseId, String body) throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("recipientId", recipientId);
        m.put("courseId", courseId);
        m.put("body", body);
        return mvc.perform(auth(jsonBody(post("/api/messages/conversations"), m), token));
    }

    private ResultActions send(String token, String conversationId, String body) throws Exception {
        return mvc.perform(auth(jsonBody(post("/api/messages/conversations/" + conversationId + "/messages"),
                Map.of("body", body)), token));
    }

    @Test
    void permissionsReuseUnreadAndReadMarking() throws Exception {
        String teacherEmail = uniqueEmail("dm-teacher");
        String teacher = signUp(teacherEmail, "INSTRUCTOR");
        String other = signUp(uniqueEmail("dm-other"), "INSTRUCTOR");
        String e1 = uniqueEmail("dm-approved");
        String e2 = uniqueEmail("dm-pending");
        String e3 = uniqueEmail("dm-rejected");
        String e4 = uniqueEmail("dm-stranger");
        String s1 = signUp(e1, "STUDENT");
        String s2 = signUp(e2, "STUDENT");
        String s3 = signUp(e3, "STUDENT");
        String s4 = signUp(e4, "STUDENT");
        String admin = admin(uniqueEmail("dm-admin"));
        String courseId = liveCourse(teacher, "Deutsch B1", "APPROVAL");
        approve(teacher, apply(s1, courseId));
        apply(s2, courseId);
        reject(teacher, apply(s3, courseId));
        String teacherId = userId(teacherEmail);

        // ---- an approved learner messages the instructor; a second "start" reuses the conversation ----
        String conv = read(start(s1, teacherId, courseId, "  Hallo Frau Lehrerin,\r\nich habe eine Frage.  ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.other.id").value(teacherId))
                .andExpect(jsonPath("$.other.role").value("INSTRUCTOR"))
                .andExpect(jsonPath("$.course.id").value(courseId))
                .andExpect(jsonPath("$.course.title").value("Deutsch B1"))
                .andExpect(jsonPath("$.lastMessage.mine").value(true))
                .andExpect(jsonPath("$.lastMessage.preview").value("Hallo Frau Lehrerin, ich habe eine Frage."))
                .andExpect(jsonPath("$.unreadCount").value(0))
                .andReturn(), "$.id");
        start(s1, teacherId, courseId, "Noch etwas!").andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(conv));
        mvc.perform(auth(get("/api/messages/conversations/with/" + teacherId).param("courseId", courseId), s1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(conv));
        mvc.perform(auth(get("/api/messages/conversations/with/" + teacherId), s1))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));

        // ---- the body keeps inner line breaks and is plain text ----
        mvc.perform(auth(get("/api/messages/conversations/" + conv + "/messages"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].body").value("Hallo Frau Lehrerin,\nich habe eine Frage."))
                .andExpect(jsonPath("$.items[0].mine").value(false))
                .andExpect(jsonPath("$.items[0].read").value(false))
                .andExpect(jsonPath("$.hasMore").value(false));

        // ---- unread counts and a single notification per conversation ----
        mvc.perform(auth(get("/api/messages/unread-count"), teacher))
                .andExpect(jsonPath("$.count").value(2)).andExpect(jsonPath("$.conversations").value(1));
        mvc.perform(auth(get("/api/messages/conversations"), teacher))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(conv))
                .andExpect(jsonPath("$.content[0].unreadCount").value(2))
                .andExpect(jsonPath("$.content[0].other.fullName").value("Test STUDENT"));
        mvc.perform(auth(get("/api/notifications"), teacher))
                .andExpect(jsonPath("$.content[0].type").value("MESSAGE"))
                .andExpect(jsonPath("$.content[0].title").value("New message from Test STUDENT"))
                .andExpect(jsonPath("$.content[0].link").value("/messages/" + conv))
                .andExpect(jsonPath("$.content[1].type").value("ENROLLMENT_REQUESTED"));
        mvc.perform(auth(post("/api/messages/conversations/" + conv + "/read"), teacher))
                .andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/messages/unread-count"), teacher))
                .andExpect(jsonPath("$.count").value(0)).andExpect(jsonPath("$.conversations").value(0));
        // the MESSAGE notification was marked read with the conversation; 3 application notifications remain
        mvc.perform(auth(get("/api/notifications/unread-count"), teacher)).andExpect(jsonPath("$.count").value(3));
        mvc.perform(auth(get("/api/messages/conversations/" + conv + "/messages"), s1))
                .andExpect(jsonPath("$.items[1].mine").value(true))
                .andExpect(jsonPath("$.items[1].read").value(true)); // seen by the instructor
        send(teacher, conv, "Gern, worum geht es?").andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true)).andExpect(jsonPath("$.read").value(false));
        mvc.perform(auth(get("/api/messages/unread-count"), s1)).andExpect(jsonPath("$.count").value(1));

        // ---- permission rules ----
        start(s4, teacherId, courseId, "Hi").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("MESSAGING_NOT_ALLOWED"));
        start(s4, teacherId, null, "Hi").andExpect(status().isForbidden());
        start(s1, userId(e2), courseId, "Hi").andExpect(status().isForbidden()); // learner → learner
        start(other, userId(e1), null, "Hi").andExpect(status().isForbidden()); // not their learner
        start(s3, teacherId, courseId, "Hi").andExpect(status().isForbidden()); // rejected learner cannot start
        String pendingConv = read(start(s2, teacherId, courseId, "Wann geht es los?")
                .andExpect(status().isCreated()).andReturn(), "$.id");
        String rejectedConv = read(start(teacher, userId(e3), courseId, "Nächstes Mal klappt es bestimmt.")
                .andExpect(status().isCreated()).andReturn(), "$.id");
        send(s3, rejectedConv, "Danke!").andExpect(status().isCreated()); // may reply
        start(teacher, userId(e1), null, "Allgemeine Frage").andExpect(status().isCreated()); // general context
        String adminConv = read(start(admin, userId(e4), null, "Willkommen bei Sprachweg")
                .andExpect(status().isCreated()).andReturn(), "$.id");
        send(s4, adminConv, "Danke").andExpect(status().isCreated());
        start(s1, userId(e1), null, "Ich").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.recipientId").exists());
        start(s1, randomId(), null, "Hi").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
        start(s1, teacherId, randomId(), "Hi").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));

        // ---- strangers cannot see or use a conversation ----
        for (String token : new String[] {other, s4, admin}) {
            mvc.perform(auth(get("/api/messages/conversations/" + conv), token)).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
            mvc.perform(auth(get("/api/messages/conversations/" + conv + "/messages"), token))
                    .andExpect(status().isNotFound());
            send(token, conv, "Hallo?").andExpect(status().isNotFound());
            mvc.perform(auth(post("/api/messages/conversations/" + conv + "/read"), token))
                    .andExpect(status().isNotFound());
        }
        mvc.perform(auth(get("/api/messages/conversations"), teacher))
                .andExpect(jsonPath("$.totalElements").value(4));
        mvc.perform(auth(get("/api/messages/conversations").param("q", "b1"), teacher))
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(auth(get("/api/messages/conversations").param("q", "zzz"), teacher))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(auth(get("/api/messages/conversations"), s2))
                .andExpect(jsonPath("$.content[0].id").value(pendingConv));
    }

    @Test
    void cursorPaginationNewestFirst() throws Exception {
        String teacher = signUp(uniqueEmail("dm-page-t"), "INSTRUCTOR");
        String email = uniqueEmail("dm-page-s");
        String student = signUp(email, "STUDENT");
        String courseId = liveCourse(teacher, "Paging", "OPEN");
        apply(student, courseId);
        String conv = read(start(teacher, userId(email), courseId, "m1").andReturn(), "$.id");
        for (int i = 2; i <= 5; i++) {
            send(teacher, conv, "m" + i).andExpect(status().isCreated());
        }
        String url = "/api/messages/conversations/" + conv + "/messages";
        String cursor = read(mvc.perform(auth(get(url).param("size", "2"), student))
                .andExpect(jsonPath("$.items[0].body").value("m4"))
                .andExpect(jsonPath("$.items[1].body").value("m5"))
                .andExpect(jsonPath("$.hasMore").value(true))
                .andReturn(), "$.nextCursor");
        cursor = read(mvc.perform(auth(get(url).param("size", "2").param("before", cursor), student))
                .andExpect(jsonPath("$.items[0].body").value("m2"))
                .andExpect(jsonPath("$.items[1].body").value("m3"))
                .andExpect(jsonPath("$.hasMore").value(true))
                .andReturn(), "$.nextCursor");
        mvc.perform(auth(get(url).param("size", "2").param("before", cursor), student))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].body").value("m1"))
                .andExpect(jsonPath("$.hasMore").value(false))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
        mvc.perform(auth(get(url).param("before", randomId()), student))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MESSAGE_NOT_FOUND"));
        mvc.perform(auth(get(url).param("before", "nope"), student))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(auth(get(url).param("size", "100000"), student)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5));
        mvc.perform(auth(get(url).param("size", "-3"), student)).andExpect(status().isOk());
    }

    @Test
    void bodyLimitsAndRateLimit() throws Exception {
        String teacher = signUp(uniqueEmail("dm-rate-t"), "INSTRUCTOR");
        String email = uniqueEmail("dm-rate-s");
        String student = signUp(email, "STUDENT");
        String courseId = liveCourse(teacher, "Rate", "OPEN");
        apply(student, courseId);
        String conv = read(start(teacher, userId(email), courseId, "x".repeat(5000))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        send(teacher, conv, "x".repeat(5001)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.body").exists());
        send(teacher, conv, "   \n  ").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.body").exists());
        start(teacher, userId(email), courseId, "").andExpect(status().isBadRequest());
        // 1 message sent so far: 29 more are allowed within the minute, the next one is rejected
        for (int i = 1; i < MessageRateLimiter.LIMIT; i++) {
            send(teacher, conv, "Nachricht " + i).andExpect(status().isCreated());
        }
        send(teacher, conv, "Eine zu viel").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(header().exists("Retry-After"));
        start(teacher, userId(email), courseId, "Auch zu viel").andExpect(status().isTooManyRequests());
        // other users are not affected
        send(student, conv, "Ich darf noch").andExpect(status().isCreated());
        mvc.perform(auth(get("/api/messages/conversations/" + conv + "/messages").param("size", "100"), student))
                .andExpect(jsonPath("$.items.length()").value(31));
    }

    @Test
    void newMessageEmailsAreDelayedAndThrottled() throws Exception {
        String teacherEmail = uniqueEmail("dm-mail-t");
        String teacher = signUp(teacherEmail, "INSTRUCTOR");
        setLocale(teacherEmail, "de");
        String email = uniqueEmail("dm-mail-s");
        String student = signUp(email, "STUDENT");
        String courseId = liveCourse(teacher, "Mail-Kurs", "OPEN");
        apply(student, courseId);
        String teacherId = userId(teacherEmail);
        clearInvocations(mail);

        Instant now = Instant.now();
        String conv = read(start(student, teacherId, courseId, "Hallo, kurze Frage zum Kurs").andReturn(), "$.id");
        mailJob.sendDue(now);
        verify(mail, never()).send(eq(teacherEmail), any());
        mailJob.sendDue(now.plus(3, ChronoUnit.MINUTES)); // still unread after the delay
        verify(mail).send(eq(teacherEmail), argThat(m -> m.subject().equals("Du hast eine neue Nachricht von Test STUDENT")
                && m.text().contains("Hallo, kurze Frage zum Kurs") && m.text().contains("„Mail-Kurs“")
                && m.text().contains("/messages/" + conv)));
        clearInvocations(mail);
        mailJob.sendDue(now.plus(5, ChronoUnit.MINUTES)); // nothing new
        send(student, conv, "Noch eine Frage").andExpect(status().isCreated());
        mailJob.sendDue(now.plus(10, ChronoUnit.MINUTES)); // throttled: at most one e-mail per 30 minutes
        verify(mail, never()).send(eq(teacherEmail), any());
        mailJob.sendDue(now.plus(34, ChronoUnit.MINUTES)); // still unread after the throttle period
        verify(mail).send(eq(teacherEmail), argThat(m -> m.text().contains("Noch eine Frage")));
        clearInvocations(mail);

        // reading cancels the pending e-mail; the learner's own reply never e-mails the learner
        send(student, conv, "Und noch eine").andExpect(status().isCreated());
        mvc.perform(auth(post("/api/messages/conversations/" + conv + "/read"), teacher))
                .andExpect(status().isNoContent());
        mailJob.sendDue(now.plus(2, ChronoUnit.HOURS));
        verify(mail, never()).send(eq(teacherEmail), any());
        verify(mail, never()).send(eq(email), any());
    }
}
