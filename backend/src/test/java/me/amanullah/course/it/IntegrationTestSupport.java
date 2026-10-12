package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import me.amanullah.course.auth.TokenType;
import me.amanullah.course.auth.VerificationToken;
import me.amanullah.course.auth.VerificationTokenRepository;
import me.amanullah.course.user.UserRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTestSupport {

    protected static final String PASSWORD = "Geheim123!";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected VerificationTokenRepository tokens;

    @Autowired
    protected TransactionTemplate tx;

    protected String json(Object body) {
        return objectMapper.writeValueAsString(body);
    }

    protected static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.org";
    }

    protected static <T> T read(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    protected MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    protected MockHttpServletRequestBuilder jsonBody(MockHttpServletRequestBuilder builder, Object body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(json(body));
    }

    protected String verificationToken(String email) {
        return tx.execute(s -> {
            var user = users.findByEmailIgnoreCase(email).orElseThrow();
            return tokens.findByUserAndTypeOrderByCreatedAtDesc(user, TokenType.EMAIL_VERIFY).stream()
                    .findFirst().map(VerificationToken::getToken).orElseThrow();
        });
    }

    /** Registers, verifies and logs in a user; returns the access token. */
    protected String signUp(String email, String role) throws Exception {
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", "Test " + role, "email", email, "password", PASSWORD, "role", role)))
                .andExpect(status().isCreated());
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email))))
                .andExpect(status().isOk());
        return login(email);
    }

    protected String login(String email) throws Exception {
        MvcResult r = mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)))
                .andExpect(status().isOk()).andReturn();
        String token = read(r, "$.accessToken");
        assertThat(token).isNotBlank();
        return token;
    }
}
