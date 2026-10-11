package de.sprachweg.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.sprachweg.user.Role;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AdminTest extends IntegrationTestSupport {

    @Test
    void adminManagesUsers() throws Exception {
        String adminEmail = uniqueEmail("admin");
        String adminToken = signUp(adminEmail, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(adminEmail).orElseThrow().setRole(Role.ADMIN));
        adminToken = login(adminEmail);
        String adminId = read(mvc.perform(auth(get("/api/users/me"), adminToken)).andReturn(), "$.id");

        String userEmail = uniqueEmail("target");
        String userToken = signUp(userEmail, "STUDENT");
        String userId = read(mvc.perform(auth(get("/api/users/me"), userToken)).andReturn(), "$.id");

        mvc.perform(auth(get("/api/admin/stats"), adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users").isNumber())
                .andExpect(jsonPath("$.liveCourses").isNumber());
        mvc.perform(auth(get("/api/admin/users").param("q", userEmail.substring(0, 12)).param("role", "STUDENT"), adminToken))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].enabled").value(true));

        mvc.perform(auth(jsonBody(put("/api/admin/users/" + userId), Map.of("role", "INSTRUCTOR")), adminToken))
                .andExpect(jsonPath("$.role").value("INSTRUCTOR"));
        mvc.perform(auth(jsonBody(put("/api/admin/users/" + userId), Map.of("enabled", false)), adminToken))
                .andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(jsonBody(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login"),
                        Map.of("email", userEmail, "password", PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"))
                .andExpect(jsonPath("$.type").value("about:blank"));

        mvc.perform(auth(jsonBody(put("/api/admin/users/" + adminId), Map.of("role", "STUDENT")), adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_MODIFY_SELF"));
    }
}
