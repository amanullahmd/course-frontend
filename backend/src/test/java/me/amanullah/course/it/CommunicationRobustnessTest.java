package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** RobustnessTest-style bad input against the announcement and messaging endpoints: always 4xx, never 5xx. */
class CommunicationRobustnessTest extends CommunicationTestSupport {

    private record Case(String name, RequestBuilder request, int status, String code) {
    }

    private final List<Case> cases = new ArrayList<>();

    private void expect(String name, RequestBuilder request, int status, String code) {
        cases.add(new Case(name, request, status, code));
    }

    private static MockHttpServletRequestBuilder raw(MockHttpServletRequestBuilder b, String json, String token) {
        b.contentType(MediaType.APPLICATION_JSON).content(json);
        return token == null ? b : b.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private static MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder b, String token) {
        return b.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    @Test
    void badInputNeverProducesServerErrors() throws Exception {
        String teacher = signUp(uniqueEmail("cr-teacher"), "INSTRUCTOR");
        String studentEmail = uniqueEmail("cr-student");
        String student = signUp(studentEmail, "STUDENT");
        String courseId = liveCourse(teacher, "Robust", "OPEN");
        apply(student, courseId);
        String ann = read(mvc.perform(as(raw(post("/api/instructor/courses/" + courseId + "/announcements"),
                "{\"title\":\"T\",\"body\":\"<p>x</p>\",\"audience\":\"ALL_APPROVED\"}", null), teacher))
                .andReturn(), "$.id");
        String conv = read(mvc.perform(as(raw(post("/api/messages/conversations"),
                "{\"recipientId\":\"" + userId(studentEmail) + "\",\"body\":\"Hallo\"}", null), teacher))
                .andReturn(), "$.id");
        String rnd = randomId();
        String annBase = "/api/instructor/courses/" + courseId + "/announcements";

        // anonymous
        expect("anon announcements", get(annBase), 401, "UNAUTHORIZED");
        expect("anon learner feed", get("/api/student/courses/" + courseId + "/announcements"), 401, "UNAUTHORIZED");
        expect("anon conversations", get("/api/messages/conversations"), 401, "UNAUTHORIZED");
        expect("anon unread", get("/api/messages/unread-count"), 401, "UNAUTHORIZED");

        // announcements
        expect("malformed json", raw(post(annBase), "{\"title\":", teacher), 400, "MALFORMED_REQUEST");
        expect("array body", raw(post(annBase), "[]", teacher), 400, "MALFORMED_REQUEST");
        expect("null body", raw(post(annBase), "null", teacher), 400, "MALFORMED_REQUEST");
        expect("empty object", raw(post(annBase), "{}", teacher), 400, "VALIDATION_FAILED");
        expect("unknown audience", raw(post(annBase),
                "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"EVERYONE\"}", teacher), 400, "MALFORMED_REQUEST");
        expect("unknown status", raw(post(annBase),
                "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"ALL_APPROVED\",\"status\":\"LATER\"}", teacher), 400,
                "MALFORMED_REQUEST");
        expect("bad scheduledAt", raw(post(annBase), "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"ALL_APPROVED\","
                + "\"status\":\"SCHEDULED\",\"scheduledAt\":\"tomorrow\"}", teacher), 400, "MALFORMED_REQUEST");
        expect("bad recipient id", raw(post(annBase), "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"SELECTED\","
                + "\"recipientIds\":[\"nope\"]}", teacher), 400, "MALFORMED_REQUEST");
        expect("null recipient id", raw(post(annBase), "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"SELECTED\","
                + "\"recipientIds\":[null]}", teacher), 400, "VALIDATION_FAILED");
        expect("title wrong type", raw(post(annBase),
                "{\"title\":{\"a\":1},\"body\":\"x\",\"audience\":\"ALL_APPROVED\"}", teacher), 400,
                "MALFORMED_REQUEST");
        expect("sendEmail wrong type", raw(post(annBase),
                "{\"title\":\"T\",\"body\":\"x\",\"audience\":\"ALL_APPROVED\",\"sendEmail\":\"maybe\"}", teacher),
                400, "MALFORMED_REQUEST");
        expect("wrong content type", as(post(annBase).contentType(MediaType.TEXT_PLAIN).content("x"), teacher), 415,
                "UNSUPPORTED_MEDIA_TYPE");
        expect("invalid course uuid", as(get("/api/instructor/courses/xyz/announcements"), teacher), 400,
                "INVALID_PARAMETER");
        expect("unknown course", as(get("/api/instructor/courses/" + rnd + "/announcements"), teacher), 404,
                "COURSE_NOT_FOUND");
        expect("invalid announcement uuid", as(get("/api/instructor/announcements/1"), teacher), 400,
                "INVALID_PARAMETER");
        expect("unknown announcement", as(get("/api/instructor/announcements/" + rnd), teacher), 404,
                "ANNOUNCEMENT_NOT_FOUND");
        expect("send unknown", as(post("/api/instructor/announcements/" + rnd + "/send"), teacher), 404,
                "ANNOUNCEMENT_NOT_FOUND");
        expect("delete unknown", as(delete("/api/instructor/announcements/" + rnd), teacher), 404,
                "ANNOUNCEMENT_NOT_FOUND");
        expect("put without body", as(put("/api/instructor/announcements/" + ann)
                .contentType(MediaType.APPLICATION_JSON), teacher), 400, "MALFORMED_REQUEST");
        expect("patch not allowed", as(patch("/api/instructor/announcements/" + ann), teacher), 405,
                "METHOD_NOT_ALLOWED");
        expect("get send", as(get("/api/instructor/announcements/" + ann + "/send"), teacher), 405,
                "METHOD_NOT_ALLOWED");
        expect("student on instructor api", as(get(annBase), student), 403, "FORBIDDEN");
        expect("learner read unknown", as(post("/api/student/announcements/" + rnd + "/read"), student), 404,
                "ANNOUNCEMENT_NOT_FOUND");
        expect("learner read invalid", as(post("/api/student/announcements/abc/read"), student), 400,
                "INVALID_PARAMETER");
        expect("learner feed unknown course", as(get("/api/student/courses/" + rnd + "/announcements"), student),
                404, "COURSE_NOT_FOUND");

        // messages
        String convs = "/api/messages/conversations";
        expect("start malformed", raw(post(convs), "{", student), 400, "MALFORMED_REQUEST");
        expect("start empty", raw(post(convs), "{}", student), 400, "VALIDATION_FAILED");
        expect("start bad recipient", raw(post(convs), "{\"recipientId\":\"x\",\"body\":\"Hi\"}", student), 400,
                "MALFORMED_REQUEST");
        expect("start body wrong type", raw(post(convs),
                "{\"recipientId\":\"" + rnd + "\",\"body\":[1,2]}", student), 400, "MALFORMED_REQUEST");
        expect("start unknown user", raw(post(convs), "{\"recipientId\":\"" + rnd + "\",\"body\":\"Hi\"}", student),
                404, "USER_NOT_FOUND");
        expect("start too long", raw(post(convs), "{\"recipientId\":\"" + rnd + "\",\"body\":\"" + "y".repeat(5001)
                + "\"}", student), 400, "VALIDATION_FAILED");
        expect("list bad paging", as(get(convs).param("page", "-4").param("size", "100000"), student), 200, null);
        expect("list wrong paging type", as(get(convs).param("page", "x"), student), 400, "INVALID_PARAMETER");
        expect("list wild query", as(get(convs).param("q", "%_\\'\""), student), 200, null);
        expect("conversation invalid id", as(get(convs + "/nope"), student), 400, "INVALID_PARAMETER");
        expect("conversation unknown", as(get(convs + "/" + rnd), student), 404, "CONVERSATION_NOT_FOUND");
        expect("messages unknown", as(get(convs + "/" + rnd + "/messages"), student), 404, "CONVERSATION_NOT_FOUND");
        expect("messages bad cursor", as(get(convs + "/" + conv + "/messages").param("before", "1"), student), 400,
                "INVALID_PARAMETER");
        expect("messages bad size", as(get(convs + "/" + conv + "/messages").param("size", "lots"), student), 400,
                "INVALID_PARAMETER");
        expect("send malformed", raw(post(convs + "/" + conv + "/messages"), "{\"body\":", student), 400,
                "MALFORMED_REQUEST");
        expect("send null", raw(post(convs + "/" + conv + "/messages"), "null", student), 400, "MALFORMED_REQUEST");
        expect("send missing body", raw(post(convs + "/" + conv + "/messages"), "{}", student), 400,
                "VALIDATION_FAILED");
        expect("send unknown conversation", raw(post(convs + "/" + rnd + "/messages"), "{\"body\":\"x\"}", student),
                404, "CONVERSATION_NOT_FOUND");
        expect("read unknown", as(post(convs + "/" + rnd + "/read"), student), 404, "CONVERSATION_NOT_FOUND");
        expect("with invalid", as(get(convs + "/with/abc"), student), 400, "INVALID_PARAMETER");
        expect("with invalid course", as(get(convs + "/with/" + rnd).param("courseId", "abc"), student), 400,
                "INVALID_PARAMETER");
        expect("unread wrong method", as(post("/api/messages/unread-count"), student), 405, "METHOD_NOT_ALLOWED");
        expect("delete conversation", as(delete(convs + "/" + conv), student), 405, "METHOD_NOT_ALLOWED");
        expect("send wrong content type", as(post(convs + "/" + conv + "/messages")
                .contentType(MediaType.APPLICATION_XML).content("<a/>"), student), 415, "UNSUPPORTED_MEDIA_TYPE");

        List<String> failures = new ArrayList<>();
        for (Case c : cases) {
            MvcResult r = mvc.perform(c.request()).andReturn();
            int status = r.getResponse().getStatus();
            String body = r.getResponse().getContentAsString();
            if (status >= 500) {
                failures.add(c.name() + ": got 5xx " + status + " " + body);
                continue;
            }
            if (status != c.status()) {
                failures.add(c.name() + ": expected " + c.status() + " but got " + status + " " + body);
                continue;
            }
            if (c.code() != null) {
                String code = body.isEmpty() ? null : JsonPath.read(body, "$.code");
                if (!c.code().equals(code)) {
                    failures.add(c.name() + ": expected code " + c.code() + " but got " + code);
                }
            }
        }
        assertThat(failures).isEmpty();
        assertThat(cases).hasSizeGreaterThan(45);
        assertThat(Map.of()).isEmpty();
    }
}
