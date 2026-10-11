package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import me.amanullah.course.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Fires bad requests at every controller as anonymous user, student, instructor and admin. Every client mistake
 * must produce a 4xx (never 5xx) with a ProblemDetail body carrying a {@code code}.
 */
class RobustnessTest extends IntegrationTestSupport {

    private record Case(String name, RequestBuilder request, int expectedStatus, String expectedCode) {
    }

    private final List<Case> cases = new ArrayList<>();

    private void expect(String name, RequestBuilder request, int status, String code) {
        cases.add(new Case(name, request, status, code));
    }

    private static MockHttpServletRequestBuilder raw(MockHttpServletRequestBuilder b, String json) {
        return b.contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static MockHttpServletRequestBuilder bearer(MockHttpServletRequestBuilder b, String token) {
        return b.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    @Test
    void clientMistakesNeverProduceServerErrors() throws Exception {
        String student = signUp(uniqueEmail("rb-student"), "STUDENT");
        String teacher = signUp(uniqueEmail("rb-teacher"), "INSTRUCTOR");
        String other = signUp(uniqueEmail("rb-other"), "INSTRUCTOR");
        String adminEmail = uniqueEmail("rb-admin");
        signUp(adminEmail, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(adminEmail).orElseThrow().setRole(Role.ADMIN));
        String admin = login(adminEmail);
        String courseId = read(mvc.perform(bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"Robust\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\"}"), teacher)).andReturn(), "$.id");
        String foreignCourse = read(mvc.perform(bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"Fremd\",\"level\":\"A2\",\"enrollmentMode\":\"OPEN\"}"), other)).andReturn(), "$.id");
        String moduleId = read(mvc.perform(bearer(raw(post("/api/instructor/courses/" + courseId + "/modules"),
                "{\"title\":\"M\"}"), teacher)).andReturn(), "$.id");
        String rnd = UUID.randomUUID().toString();
        String validItem = "{\"type\":\"TEXT\",\"title\":\"T\"}";

        // ---------------- anonymous ----------------
        expect("unknown public route", get("/api/public/nope"), 404, "NOT_FOUND");
        expect("unknown root route", get("/definitely/not/here"), 401, "UNAUTHORIZED");
        expect("unknown api route", get("/api/nope"), 401, "UNAUTHORIZED");
        expect("direct /error", get("/error"), 404, "NOT_FOUND");
        expect("malformed json", raw(post("/api/auth/login"), "{\"email\":"), 400, "MALFORMED_REQUEST");
        expect("empty body", post("/api/auth/login").contentType(MediaType.APPLICATION_JSON), 400, "MALFORMED_REQUEST");
        expect("json array instead of object", raw(post("/api/auth/login"), "[]"), 400, "MALFORMED_REQUEST");
        expect("json null body", raw(post("/api/auth/login"), "null"), 400, "MALFORMED_REQUEST");
        expect("wrong content type", post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("x"), 415,
                "UNSUPPORTED_MEDIA_TYPE");
        expect("no content type", post("/api/auth/login").content("{}"), 415, "UNSUPPORTED_MEDIA_TYPE");
        expect("wrong method", get("/api/auth/login"), 405, "METHOD_NOT_ALLOWED");
        expect("invalid enum", raw(post("/api/auth/register"),
                "{\"fullName\":\"A\",\"email\":\"a@b.de\",\"password\":\"Passwort1\",\"role\":\"GOD\"}"), 400,
                "MALFORMED_REQUEST");
        expect("admin role", raw(post("/api/auth/register"),
                "{\"fullName\":\"A\",\"email\":\"" + uniqueEmail("x") + "\",\"password\":\"Passwort1\",\"role\":\"ADMIN\"}"),
                400, "INVALID_ROLE");
        expect("null fields", raw(post("/api/auth/register"),
                "{\"fullName\":null,\"email\":null,\"password\":null,\"role\":null}"), 400, "VALIDATION_FAILED");
        expect("huge password", raw(post("/api/auth/register"), "{\"fullName\":\"A\",\"email\":\"a@b.de\",\"password\":\"a1"
                + "x".repeat(300) + "\",\"role\":\"STUDENT\"}"), 400, "VALIDATION_FAILED");
        expect("huge login password", raw(post("/api/auth/login"),
                "{\"email\":\"a@b.de\",\"password\":\"" + "x".repeat(500) + "\"}"), 400, "VALIDATION_FAILED");
        expect("wrong json type", raw(post("/api/auth/verify-email"), "{\"token\":{\"a\":1}}"), 400, "MALFORMED_REQUEST");
        expect("unknown token", raw(post("/api/auth/verify-email"), "{\"token\":\"abc\"}"), 400, "INVALID_TOKEN");
        expect("reset unknown token", raw(post("/api/auth/reset-password"),
                "{\"token\":\"abc\",\"password\":\"Passwort123\"}"), 400, "INVALID_TOKEN");
        expect("refresh without cookie", post("/api/auth/refresh"), 401, "INVALID_REFRESH_TOKEN");
        expect("non-numeric page", get("/api/public/courses").param("page", "abc"), 400, "INVALID_PARAMETER");
        expect("invalid level", get("/api/public/courses").param("level", "Z9"), 400, "INVALID_PARAMETER");
        expect("unknown slug", get("/api/public/courses/unknown-slug"), 404, "COURSE_NOT_FOUND");
        expect("media invalid uuid", get("/api/media/not-a-uuid/content").param("expires", "1").param("sig", "x"),
                400, "INVALID_PARAMETER");
        expect("media missing params", get("/api/media/" + rnd + "/content"), 400, "BAD_REQUEST");
        expect("media bad expires", get("/api/media/" + rnd + "/content").param("expires", "soon").param("sig", "x"),
                400, "INVALID_PARAMETER");
        expect("media huge expires", get("/api/media/" + rnd + "/content").param("expires", "99999999999999999999")
                .param("sig", "x"), 400, "INVALID_PARAMETER");
        expect("media bad download flag", get("/api/media/" + rnd + "/content").param("expires", "1")
                .param("sig", "x").param("download", "maybe"), 400, "INVALID_PARAMETER");
        expect("media forged signature", get("/api/media/" + rnd + "/content").param("expires", "1")
                .param("sig", "x"), 403, "INVALID_SIGNATURE");
        expect("instructor anonymous", get("/api/instructor/courses"), 401, "UNAUTHORIZED");
        expect("garbage bearer", bearer(get("/api/users/me"), "garbage"), 401, "UNAUTHORIZED");

        // ---------------- student ----------------
        expect("student → instructor api", bearer(get("/api/instructor/courses"), student), 403, "FORBIDDEN");
        expect("student → admin api", bearer(get("/api/admin/users"), student), 403, "FORBIDDEN");
        expect("upload json instead of multipart", bearer(raw(post("/api/media"), "{}"), student), 400, "FILE_REQUIRED");
        expect("upload without body", bearer(post("/api/media"), student), 400, "FILE_REQUIRED");
        expect("upload wrong part name", multipart("/api/media")
                .file(new MockMultipartFile("upload", "a.txt", "text/plain", "x".getBytes()))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + student), 400, "FILE_REQUIRED");
        expect("upload empty file", multipart("/api/media")
                .file(new MockMultipartFile("file", "a.txt", "text/plain", new byte[0]))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + student), 400, "FILE_EMPTY");
        expect("media get invalid uuid", bearer(get("/api/media/abc"), student), 400, "INVALID_PARAMETER");
        expect("media get unknown", bearer(get("/api/media/" + rnd), student), 404, "MEDIA_NOT_FOUND");
        expect("media delete unknown", bearer(delete("/api/media/" + rnd), student), 404, "MEDIA_NOT_FOUND");
        expect("apply invalid uuid", bearer(raw(post("/api/student/courses/xyz/enrollments"), "{}"), student), 400,
                "INVALID_PARAMETER");
        expect("apply unknown course", bearer(raw(post("/api/student/courses/" + rnd + "/enrollments"), "{}"), student),
                404, "COURSE_NOT_FOUND");
        expect("apply wrong message type", bearer(raw(post("/api/student/courses/" + rnd + "/enrollments"),
                "{\"message\":{}}"), student), 400, "MALFORMED_REQUEST");
        expect("apply draft course", bearer(raw(post("/api/student/courses/" + courseId + "/enrollments"), "{}"),
                student), 404, "COURSE_NOT_FOUND");
        expect("my enrollment none", bearer(get("/api/student/courses/" + courseId + "/enrollment"), student), 404,
                "ENROLLMENT_NOT_FOUND");
        expect("learn unknown", bearer(get("/api/student/courses/" + rnd + "/learn"), student), 404, "COURSE_NOT_FOUND");
        expect("item unknown", bearer(get("/api/student/items/" + rnd), student), 404, "ITEM_NOT_FOUND");
        expect("complete unknown", bearer(post("/api/student/items/" + rnd + "/complete"), student), 404,
                "ITEM_NOT_FOUND");
        expect("start attempt unknown", bearer(post("/api/student/items/" + rnd + "/attempts"), student), 404,
                "ITEM_NOT_FOUND");
        expect("submit empty object", bearer(raw(post("/api/student/attempts/" + rnd + "/submit"), "{}"), student), 400,
                "VALIDATION_FAILED");
        expect("submit invalid uuid in body", bearer(raw(post("/api/student/attempts/" + rnd + "/submit"),
                "{\"answers\":[{\"questionId\":\"x\"}]}"), student), 400, "MALFORMED_REQUEST");
        expect("submit null element", bearer(raw(post("/api/student/attempts/" + rnd + "/submit"),
                "{\"answers\":[null]}"), student), 400, "VALIDATION_FAILED");
        expect("submit null option id", bearer(raw(post("/api/student/attempts/" + rnd + "/submit"),
                "{\"answers\":[{\"questionId\":\"" + rnd + "\",\"selectedOptionIds\":[null]}]}"), student), 400,
                "VALIDATION_FAILED");
        expect("submit unknown attempt", bearer(raw(post("/api/student/attempts/" + rnd + "/submit"),
                "{\"answers\":[]}"), student), 404, "ATTEMPT_NOT_FOUND");
        expect("attempt result unknown", bearer(get("/api/student/attempts/" + rnd), student), 404, "ATTEMPT_NOT_FOUND");
        expect("withdraw unknown", bearer(post("/api/student/enrollments/" + rnd + "/withdraw"), student), 404,
                "ENROLLMENT_NOT_FOUND");
        expect("withdraw wrong method", bearer(get("/api/student/enrollments/" + rnd + "/withdraw"), student), 405,
                "METHOD_NOT_ALLOWED");
        expect("notification read unknown", bearer(post("/api/notifications/" + rnd + "/read"), student), 404,
                "NOTIFICATION_NOT_FOUND");
        expect("notification wrong method", bearer(post("/api/notifications/unread-count"), student), 405,
                "METHOD_NOT_ALLOWED");
        expect("profile null name", bearer(raw(put("/api/users/me"), "{\"fullName\":null}"), student), 400,
                "VALIDATION_FAILED");
        expect("profile invalid avatar id", bearer(raw(put("/api/users/me"),
                "{\"fullName\":\"A\",\"avatarMediaId\":\"nope\"}"), student), 400, "MALFORMED_REQUEST");
        expect("profile unknown avatar", bearer(raw(put("/api/users/me"),
                "{\"fullName\":\"A\",\"avatarMediaId\":\"" + rnd + "\"}"), student), 404, "MEDIA_NOT_FOUND");
        expect("profile text/plain", bearer(put("/api/users/me").contentType(MediaType.TEXT_PLAIN).content("x"),
                student), 415, "UNSUPPORTED_MEDIA_TYPE");
        expect("profile delete", bearer(delete("/api/users/me"), student), 405, "METHOD_NOT_ALLOWED");
        expect("password empty", bearer(raw(put("/api/users/me/password"), "{}"), student), 400, "VALIDATION_FAILED");
        expect("password wrong", bearer(raw(put("/api/users/me/password"),
                "{\"currentPassword\":\"nope\",\"newPassword\":\"Passwort123\"}"), student), 400, "INVALID_PASSWORD");
        expect("locale invalid", bearer(raw(put("/api/users/me/locale"), "{\"locale\":\"fr\"}"), student), 400,
                "VALIDATION_FAILED");

        // ---------------- instructor ----------------
        expect("course empty object", bearer(raw(post("/api/instructor/courses"), "{}"), teacher), 400,
                "VALIDATION_FAILED");
        expect("course invalid level", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"Z9\",\"enrollmentMode\":\"OPEN\"}"), teacher), 400, "MALFORMED_REQUEST");
        expect("course capacity text", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"capacity\":\"many\"}"), teacher), 400,
                "MALFORMED_REQUEST");
        expect("course capacity overflow", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"capacity\":1e30}"), teacher), 400,
                "MALFORMED_REQUEST");
        expect("course capacity negative", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"capacity\":-1}"), teacher), 400,
                "VALIDATION_FAILED");
        expect("course null tag", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"tags\":[null]}"), teacher), 400,
                "VALIDATION_FAILED");
        expect("course unknown cover", bearer(raw(post("/api/instructor/courses"),
                "{\"title\":\"T\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\",\"coverImageId\":\"" + rnd + "\"}"),
                teacher), 404, "MEDIA_NOT_FOUND");
        expect("course invalid uuid", bearer(get("/api/instructor/courses/not-a-uuid"), teacher), 400,
                "INVALID_PARAMETER");
        expect("course unknown", bearer(get("/api/instructor/courses/" + rnd), teacher), 404, "COURSE_NOT_FOUND");
        expect("course foreign", bearer(get("/api/instructor/courses/" + foreignCourse), teacher), 404,
                "COURSE_NOT_FOUND");
        expect("course foreign update", bearer(raw(put("/api/instructor/courses/" + foreignCourse),
                "{\"title\":\"X\",\"level\":\"A1\",\"enrollmentMode\":\"OPEN\"}"), teacher), 404, "COURSE_NOT_FOUND");
        expect("course foreign delete", bearer(delete("/api/instructor/courses/" + foreignCourse), teacher), 404,
                "COURSE_NOT_FOUND");
        expect("course patch", bearer(patch("/api/instructor/courses/" + courseId), teacher), 405, "METHOD_NOT_ALLOWED");
        expect("publication invalid status", bearer(raw(put("/api/instructor/courses/" + courseId + "/publication"),
                "{\"publishStatus\":\"MAYBE\"}"), teacher), 400, "MALFORMED_REQUEST");
        expect("publication invalid date", bearer(raw(put("/api/instructor/courses/" + courseId + "/publication"),
                "{\"publishStatus\":\"PUBLISHED\",\"publishAt\":\"tomorrow\"}"), teacher), 400, "MALFORMED_REQUEST");
        expect("publication empty", bearer(raw(put("/api/instructor/courses/" + courseId + "/publication"), "{}"),
                teacher), 400, "VALIDATION_FAILED");
        expect("module order null", bearer(raw(put("/api/instructor/courses/" + courseId + "/modules/order"),
                "{\"ids\":null}"), teacher), 400, "VALIDATION_FAILED");
        expect("module order invalid uuid", bearer(raw(put("/api/instructor/courses/" + courseId + "/modules/order"),
                "{\"ids\":[\"x\"]}"), teacher), 400, "MALFORMED_REQUEST");
        expect("module order unknown id", bearer(raw(put("/api/instructor/courses/" + courseId + "/modules/order"),
                "{\"ids\":[\"" + rnd + "\"]}"), teacher), 400, "VALIDATION_FAILED");
        expect("module blank title", bearer(raw(post("/api/instructor/courses/" + courseId + "/modules"),
                "{\"title\":\"\"}"), teacher), 400, "VALIDATION_FAILED");
        expect("module unknown", bearer(raw(put("/api/instructor/modules/" + rnd), "{\"title\":\"X\"}"), teacher), 404,
                "MODULE_NOT_FOUND");
        expect("item in unknown module", bearer(raw(post("/api/instructor/modules/" + rnd + "/items"), validItem),
                teacher), 404, "MODULE_NOT_FOUND");
        expect("item invalid type", bearer(raw(post("/api/instructor/modules/" + moduleId + "/items"),
                "{\"type\":\"PODCAST\",\"title\":\"T\"}"), teacher), 400, "MALFORMED_REQUEST");
        expect("item bad url", bearer(raw(post("/api/instructor/modules/" + moduleId + "/items"),
                "{\"type\":\"EMBED\",\"title\":\"T\",\"externalUrl\":\"javascript:alert(1)\"}"), teacher), 400,
                "VALIDATION_FAILED");
        expect("item unknown attachment", bearer(raw(post("/api/instructor/modules/" + moduleId + "/items"),
                "{\"type\":\"TEXT\",\"title\":\"T\",\"attachmentIds\":[\"" + rnd + "\"]}"), teacher), 404,
                "MEDIA_NOT_FOUND");
        expect("item order unknown module", bearer(raw(put("/api/instructor/modules/" + rnd + "/items/order"),
                "{\"ids\":[]}"), teacher), 404, "MODULE_NOT_FOUND");
        expect("item order duplicates", bearer(raw(put("/api/instructor/modules/" + moduleId + "/items/order"),
                "{\"ids\":[\"" + rnd + "\",\"" + rnd + "\"]}"), teacher), 400, "VALIDATION_FAILED");
        expect("item unknown", bearer(get("/api/instructor/items/" + rnd), teacher), 404, "ITEM_NOT_FOUND");
        expect("assessment unknown item", bearer(get("/api/instructor/items/" + rnd + "/assessment"), teacher), 404,
                "ITEM_NOT_FOUND");
        expect("assessment null type", bearer(raw(put("/api/instructor/items/" + rnd + "/assessment"),
                "{\"questions\":[{\"type\":null,\"prompt\":\"x\"}]}"), teacher), 400, "VALIDATION_FAILED");
        expect("assessment passing score 500", bearer(raw(put("/api/instructor/items/" + rnd + "/assessment"),
                "{\"passingScore\":500}"), teacher), 400, "VALIDATION_FAILED");
        expect("attempts unknown item", bearer(get("/api/instructor/items/" + rnd + "/attempts"), teacher), 404,
                "ITEM_NOT_FOUND");
        expect("attempt unknown", bearer(get("/api/instructor/attempts/" + rnd), teacher), 404, "ATTEMPT_NOT_FOUND");
        expect("grade empty", bearer(raw(post("/api/instructor/attempts/" + rnd + "/grade"), "{\"grades\":[]}"),
                teacher), 400, "VALIDATION_FAILED");
        expect("grade negative", bearer(raw(post("/api/instructor/attempts/" + rnd + "/grade"),
                "{\"grades\":[{\"questionId\":\"" + rnd + "\",\"pointsAwarded\":-1}]}"), teacher), 400,
                "VALIDATION_FAILED");
        expect("bulk empty ids", bearer(raw(post("/api/instructor/enrollments/bulk"),
                "{\"ids\":[],\"action\":\"APPROVE\"}"), teacher), 400, "VALIDATION_FAILED");
        expect("bulk invalid action", bearer(raw(post("/api/instructor/enrollments/bulk"),
                "{\"ids\":[\"" + rnd + "\"],\"action\":\"MAYBE\"}"), teacher), 400, "MALFORMED_REQUEST");
        expect("bulk unknown", bearer(raw(post("/api/instructor/enrollments/bulk"),
                "{\"ids\":[\"" + rnd + "\"],\"action\":\"REJECT\"}"), teacher), 404, "ENROLLMENT_NOT_FOUND");
        expect("approve unknown", bearer(post("/api/instructor/enrollments/" + rnd + "/approve"), teacher), 404,
                "ENROLLMENT_NOT_FOUND");
        expect("reject array body", bearer(raw(post("/api/instructor/enrollments/" + rnd + "/reject"), "[]"), teacher),
                400, "MALFORMED_REQUEST");
        expect("enrollments invalid status", bearer(get("/api/instructor/courses/" + courseId + "/enrollments")
                .param("status", "NOPE"), teacher), 400, "INVALID_PARAMETER");
        expect("enrollments foreign course", bearer(get("/api/instructor/courses/" + foreignCourse + "/enrollments"),
                teacher), 404, "COURSE_NOT_FOUND");
        expect("schedule invalid from", bearer(get("/api/instructor/schedule").param("from", "yesterday"), teacher), 400,
                "INVALID_PARAMETER");
        expect("schedule reversed", bearer(get("/api/instructor/schedule").param("from", "2030-01-02T00:00:00Z")
                .param("to", "2030-01-01T00:00:00Z"), teacher), 400, "VALIDATION_FAILED");
        expect("schedule invalid course id", bearer(get("/api/instructor/schedule").param("courseId", "abc"), teacher),
                400, "INVALID_PARAMETER");
        expect("instructor → admin", bearer(get("/api/admin/stats"), teacher), 403, "FORBIDDEN");
        expect("not acceptable", bearer(get("/api/instructor/courses").accept(MediaType.APPLICATION_XML), teacher), 406,
                null);

        // ---------------- admin ----------------
        expect("admin invalid role filter", bearer(get("/api/admin/users").param("role", "GOD"), admin), 400,
                "INVALID_PARAMETER");
        expect("admin unknown user", bearer(raw(put("/api/admin/users/" + rnd), "{}"), admin), 404, "USER_NOT_FOUND");
        expect("admin invalid user id", bearer(raw(put("/api/admin/users/abc"), "{}"), admin), 400, "INVALID_PARAMETER");
        expect("admin invalid role", bearer(raw(put("/api/admin/users/" + rnd), "{\"role\":\"KING\"}"), admin), 400,
                "MALFORMED_REQUEST");
        expect("admin enabled text", bearer(raw(put("/api/admin/users/" + rnd), "{\"enabled\":\"yes please\"}"), admin),
                400, "MALFORMED_REQUEST");

        assertThat(cases).hasSizeGreaterThan(100);
        List<String> failures = new ArrayList<>();
        for (Case c : cases) {
            MvcResult r = mvc.perform(c.request()).andReturn();
            int status = r.getResponse().getStatus();
            String body = r.getResponse().getContentAsString();
            String code = null;
            try {
                code = body.isEmpty() ? null : JsonPath.read(body, "$.code");
            } catch (Exception ignored) {
                // not JSON
            }
            boolean ok = status == c.expectedStatus() && (c.expectedCode() == null || c.expectedCode().equals(code));
            if (status >= 500 || !ok) {
                failures.add(c.name() + ": expected " + c.expectedStatus() + "/" + c.expectedCode() + " but got "
                        + status + "/" + code + " " + body);
            }
        }
        assertThat(failures).as("requests with unexpected responses").isEmpty();
    }

    @Test
    void pagingParametersAreClamped() throws Exception {
        String adminEmail = uniqueEmail("clamp-admin");
        signUp(adminEmail, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(adminEmail).orElseThrow().setRole(Role.ADMIN));
        String admin = login(adminEmail);
        mvc.perform(get("/api/public/courses").param("page", "-5").param("size", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(100));
        mvc.perform(get("/api/public/courses").param("size", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(20));
        mvc.perform(bearer(get("/api/admin/users").param("page", "-1").param("size", "999999"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
        mvc.perform(bearer(get("/api/notifications").param("page", "-1").param("size", "999999"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
        // a stale token on a public endpoint is ignored instead of causing a 401
        mvc.perform(bearer(get("/api/public/courses"), "expired.or.garbage")).andExpect(status().isOk());
        mvc.perform(bearer(post("/api/auth/refresh"), "garbage"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
        assertThat(Map.of()).isEmpty();
    }
}
