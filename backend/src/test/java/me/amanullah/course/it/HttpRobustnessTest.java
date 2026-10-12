package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import me.amanullah.course.auth.TokenType;
import me.amanullah.course.auth.VerificationTokenRepository;
import me.amanullah.course.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Real HTTP round trips (Tomcat): multipart size limits enforced by the container, {@code /error}, and errors raised
 * by servlet filters outside Spring MVC all produce ProblemDetail JSON with a {@code code}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class HttpRobustnessTest {

    @TestConfiguration
    static class FaultyFilters {

        @Bean
        FilterRegistrationBean<Filter> faultyFilter() {
            FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>((request, response, chain) -> {
                String uri = ((jakarta.servlet.http.HttpServletRequest) request).getRequestURI();
                if (uri.equals("/test/boom")) {
                    throw new IllegalStateException("secret internal detail");
                }
                if (uri.equals("/test/send-error")) {
                    ((HttpServletResponse) response).sendError(400);
                    return;
                }
                chain.doFilter(request, response);
            });
            bean.addUrlPatterns("/test/*");
            bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
            return bean;
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    UserRepository users;

    @Autowired
    VerificationTokenRepository tokens;

    @Autowired
    TransactionTemplate tx;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> send(HttpRequest.Builder b) throws Exception {
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder req(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private static HttpRequest.BodyPublisher json(String body) {
        return HttpRequest.BodyPublishers.ofString(body);
    }

    private static void assertProblem(HttpResponse<String> r, int status, String code) {
        assertThat(r.statusCode()).as(r.body()).isEqualTo(status);
        assertThat(r.headers().firstValue("Content-Type").orElse("")).contains("json");
        assertThat((String) JsonPath.read(r.body(), "$.code")).isEqualTo(code);
        assertThat((Object) JsonPath.read(r.body(), "$.detail")).isNotNull();
        assertThat(r.body()).doesNotContain("Exception").doesNotContain("stackTrace").doesNotContain("\tat ");
    }

    /** An instructor: students may only upload an allow-list of file types, and this test uploads raw bytes. */
    private String token() throws Exception {
        String email = "http-" + UUID.randomUUID().toString().substring(0, 8) + "@example.org";
        send(req("/api/auth/register").header("Content-Type", "application/json").POST(json(
                "{\"fullName\":\"Http\",\"email\":\"" + email + "\",\"password\":\"Passwort123\",\"role\":\"INSTRUCTOR\"}")));
        String verify = tx.execute(s -> tokens.findByUserAndTypeOrderByCreatedAtDesc(
                users.findByEmailIgnoreCase(email).orElseThrow(), TokenType.EMAIL_VERIFY).getFirst().getToken());
        send(req("/api/auth/verify-email").header("Content-Type", "application/json")
                .POST(json("{\"token\":\"" + verify + "\"}")));
        HttpResponse<String> login = send(req("/api/auth/login").header("Content-Type", "application/json")
                .POST(json("{\"email\":\"" + email + "\",\"password\":\"Passwort123\"}")));
        return JsonPath.read(login.body(), "$.accessToken");
    }

    private static byte[] multipartBody(String boundary, String field, String fileName, int size) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + field + "\"; filename=\""
                + fileName + "\"\r\nContent-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.writeBytes(new byte[size]);
        out.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private HttpResponse<String> upload(String token, int size) throws Exception {
        String boundary = "----sprachweg" + UUID.randomUUID();
        return send(req("/api/media").header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody(boundary, "file", "big.bin", size))));
    }

    @Test
    void uploadSizeLimitsAreReportedAs413() throws Exception {
        String token = token();
        assertThat(upload(token, 1024).statusCode()).isEqualTo(201);
        // file larger than max-file-size (10KB) but request below max-request-size (20KB)
        assertProblem(upload(token, 15 * 1024), 413, "FILE_TOO_LARGE");
        // request larger than max-request-size
        assertProblem(upload(token, 200 * 1024), 413, "FILE_TOO_LARGE");
        // German detail
        String boundary = "----b" + UUID.randomUUID();
        HttpResponse<String> de = send(req("/api/media").header("Authorization", "Bearer " + token)
                .header("Accept-Language", "de")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody(boundary, "file", "x.bin", 50 * 1024))));
        assertProblem(de, 413, "FILE_TOO_LARGE");
        assertThat((String) JsonPath.read(de.body(), "$.detail")).isEqualTo("Die hochgeladene Datei ist zu groß.");
    }

    @Test
    void errorEndpointAndFilterErrorsUseProblemDetails() throws Exception {
        assertProblem(send(req("/error")), 404, "NOT_FOUND");
        assertProblem(send(req("/error").POST(json("{}"))), 404, "NOT_FOUND");

        HttpResponse<String> boom = send(req("/test/boom").header("Accept-Language", "de"));
        assertProblem(boom, 500, "INTERNAL_ERROR");
        assertThat(boom.body()).doesNotContain("secret internal detail");
        assertThat((String) JsonPath.read(boom.body(), "$.instance")).isEqualTo("/test/boom");
        assertThat((String) JsonPath.read(boom.body(), "$.traceId")).isNotBlank();
        assertThat((String) JsonPath.read(boom.body(), "$.detail")).startsWith("Ein unerwarteter Fehler");

        assertProblem(send(req("/test/send-error")), 400, "BAD_REQUEST");
    }

    @Test
    void containerAndFirewallLevelRejectionsAreProblemDetails() throws Exception {
        // semicolon / encoded path traversal are rejected by Spring Security's HTTP firewall
        assertProblem(send(req("/api/public/courses;jsessionid=abc")), 400, "BAD_REQUEST");
        assertProblem(send(req("/api/public/courses/%2e%2e/admin")), 400, "BAD_REQUEST");
        // plain client errors over real HTTP
        assertProblem(send(req("/api/auth/login").header("Content-Type", "application/json").POST(json("{oops"))),
                400, "MALFORMED_REQUEST");
        assertProblem(send(req("/api/public/does-not-exist")), 404, "NOT_FOUND");
        assertProblem(send(req("/api/auth/login").DELETE()), 405, "METHOD_NOT_ALLOWED");
        assertProblem(send(req("/api/users/me")), 401, "UNAUTHORIZED");
    }
}
