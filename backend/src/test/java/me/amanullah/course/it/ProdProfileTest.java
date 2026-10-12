package me.amanullah.course.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Boots with the real {@code application-prod.yml} (on an in-memory database): Swagger UI and the OpenAPI document
 * must not be reachable, and the API still answers with security headers.
 */
@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:sprachweg-prod;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "DB_USERNAME=sa", "DB_PASSWORD=",
        "JWT_SECRET=prod-like-test-jwt-secret-0123456789abcdef",
        "MEDIA_SECRET=prod-like-test-media-secret-0123456789abcdef",
        "MAIL_ENABLED=false", "STORAGE_LOCATION=./target/test-uploads-prod"})
@AutoConfigureMockMvc
@ActiveProfiles({"test", "prod"})
class ProdProfileTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void swaggerAndApiDocsAreDisabled() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
        mvc.perform(get("/v3/api-docs/swagger-config")).andExpect(status().isNotFound());
        mvc.perform(get("/swagger-ui.html")).andExpect(status().isNotFound());
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
    }

    @Test
    void apiStillWorksWithSecurityHeaders() throws Exception {
        mvc.perform(get("/api/public/courses").secure(true))
                .andExpect(status().isOk())
                .andExpect(header().string("Strict-Transport-Security", "max-age=31536000 ; includeSubDomains"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }
}
