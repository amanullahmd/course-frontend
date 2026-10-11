package de.sprachweg.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.sprachweg.auth.TokenType;
import de.sprachweg.auth.VerificationToken;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

class AuthFlowTest extends IntegrationTestSupport {

    @Test
    void registerVerifyLoginRefreshLogout() throws Exception {
        String email = uniqueEmail("luca");
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", "Luca Rossi", "email", email, "password", PASSWORD, "role", "STUDENT")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").isNotEmpty());

        // duplicate e-mail
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", "Luca Rossi", "email", email.toUpperCase(), "password", PASSWORD, "role", "STUDENT")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));

        // login blocked until verified
        mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));

        String token = verificationToken(email);
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", token)))
                .andExpect(status().isOk());
        // single use
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_USED"));

        MvcResult login = mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.role").value("STUDENT"))
                .andExpect(jsonPath("$.user.emailVerified").value(true))
                .andReturn();
        String setCookie = login.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).contains("refresh_token=").contains("HttpOnly").contains("Path=/api/auth")
                .contains("SameSite=Lax");
        String access = read(login, "$.accessToken");
        Cookie refresh = login.getResponse().getCookie("refresh_token");
        assertThat(refresh).isNotNull();

        mvc.perform(auth(get("/api/users/me"), access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Luca Rossi"));

        // refresh rotates the cookie
        MvcResult refreshed = mvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        Cookie rotated = refreshed.getResponse().getCookie("refresh_token");
        assertThat(rotated).isNotNull();
        assertThat(rotated.getValue()).isNotEqualTo(refresh.getValue());

        // the old token is no longer valid (and its reuse revokes the session family)
        mvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
        mvc.perform(post("/api/auth/refresh").cookie(rotated))
                .andExpect(status().isUnauthorized());

        // fresh login, then logout revokes
        MvcResult login2 = mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD)))
                .andExpect(status().isOk()).andReturn();
        Cookie c2 = login2.getResponse().getCookie("refresh_token");
        mvc.perform(post("/api/auth/logout").cookie(c2)).andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh").cookie(c2)).andExpect(status().isUnauthorized());
    }

    @Test
    void forgotAndResetPassword() throws Exception {
        String email = uniqueEmail("reset");
        signUp(email, "STUDENT");

        mvc.perform(jsonBody(post("/api/auth/forgot-password"), Map.of("email", email)))
                .andExpect(status().isOk());
        // generic response for unknown addresses too
        mvc.perform(jsonBody(post("/api/auth/forgot-password"), Map.of("email", "nobody@example.org")))
                .andExpect(status().isOk());

        String token = tx.execute(s -> tokens.findByUserAndTypeOrderByCreatedAtDesc(
                users.findByEmailIgnoreCase(email).orElseThrow(), TokenType.PASSWORD_RESET).getFirst().getToken());
        mvc.perform(jsonBody(post("/api/auth/reset-password"), Map.of("token", token, "password", "NeuesPasswort9")))
                .andExpect(status().isOk());
        mvc.perform(jsonBody(post("/api/auth/reset-password"), Map.of("token", token, "password", "NeuesPasswort9")))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", "NeuesPasswort9")))
                .andExpect(status().isOk());
    }

    @Test
    void validationErrorsAreProblemDetails() throws Exception {
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", "", "email", "not-an-email", "password", "short", "role", "STUDENT")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists())
                .andExpect(jsonPath("$.errors.fullName").exists());

        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", "Evil", "email", uniqueEmail("admin"), "password", PASSWORD, "role", "ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ROLE"));
    }

    @Test
    void profileUpdateAndPasswordChange() throws Exception {
        String email = uniqueEmail("profile");
        String token = signUp(email, "INSTRUCTOR");
        mvc.perform(auth(jsonBody(put("/api/users/me"), Map.of("fullName", "Anna Schneider", "bio", "DaF-Lehrerin")), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Anna Schneider"))
                .andExpect(jsonPath("$.bio").value("DaF-Lehrerin"));
        mvc.perform(auth(jsonBody(put("/api/users/me/password"),
                        Map.of("currentPassword", "wrong", "newPassword", "Anders1234")), token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PASSWORD"));
        mvc.perform(auth(jsonBody(put("/api/users/me/password"),
                        Map.of("currentPassword", PASSWORD, "newPassword", "Anders1234")), token))
                .andExpect(status().isNoContent());
    }

    @Test
    void protectedEndpointsNeedAuthenticationAndRoles() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        String student = signUp(uniqueEmail("plain"), "STUDENT");
        mvc.perform(auth(get("/api/instructor/courses"), student)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/admin/stats"), student)).andExpect(status().isForbidden());
    }
}
