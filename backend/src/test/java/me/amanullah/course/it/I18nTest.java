package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

/** English is the default; {@code Accept-Language: de} switches error details and validation messages to German. */
class I18nTest extends IntegrationTestSupport {

    @Autowired
    NotificationService notifications;

    @Autowired
    EmailTemplates templates;

    @Test
    void apiExceptionDetailsFollowAcceptLanguage() throws Exception {
        Map<String, String> bad = Map.of("email", "nobody@example.org", "password", "wrong-password-1");
        mvc.perform(jsonBody(post("/api/auth/login"), bad))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.detail").value("Email or password is incorrect."));
        mvc.perform(jsonBody(post("/api/auth/login"), bad).header(HttpHeaders.ACCEPT_LANGUAGE, "de-DE,de;q=0.9"))
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.detail").value("E-Mail-Adresse oder Passwort ist falsch."));
        // unsupported language → English
        mvc.perform(jsonBody(post("/api/auth/login"), bad).header(HttpHeaders.ACCEPT_LANGUAGE, "fr"))
                .andExpect(jsonPath("$.detail").value("Email or password is incorrect."));
        // security entry point (outside the DispatcherServlet)
        mvc.perform(get("/api/users/me").header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Bitte melde dich an, um fortzufahren."));
        mvc.perform(get("/api/users/me"))
                .andExpect(jsonPath("$.detail").value("Please log in to continue."));
    }

    @Test
    void beanValidationMessagesFollowAcceptLanguage() throws Exception {
        Map<String, String> body = Map.of("fullName", "X", "email", "not-an-email", "password", "short",
                "role", "STUDENT", "locale", "fr");
        mvc.perform(jsonBody(post("/api/auth/register"), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.detail").value("Some fields are invalid. Please check your input."))
                .andExpect(jsonPath("$.errors.password")
                        .value("must be 8 to 64 characters long and contain a letter and a digit"))
                .andExpect(jsonPath("$.errors.locale").value("must be \"en\" or \"de\""))
                .andExpect(jsonPath("$.errors.email").value("must be a well-formed email address"));
        mvc.perform(jsonBody(post("/api/auth/register"), body).header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Einige Felder sind ungültig. Bitte überprüfe deine Eingaben."))
                .andExpect(jsonPath("$.errors.password").value(
                        "muss 8 bis 64 Zeichen lang sein und einen Buchstaben sowie eine Ziffer enthalten"))
                .andExpect(jsonPath("$.errors.email").value("muss eine korrekt formatierte E-Mail-Adresse sein"));
    }

    @Test
    void serviceFieldErrorsAreLocalized() throws Exception {
        String teacher = signUp(uniqueEmail("i18n-teacher"), "INSTRUCTOR");
        String courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of("title", "Kurs",
                "level", "A1", "enrollmentMode", "OPEN")), teacher)).andReturn(), "$.id");
        Map<String, Object> pub = new HashMap<>();
        pub.put("publishStatus", "PUBLISHED");
        pub.put("publishAt", "2030-01-02T00:00:00Z");
        pub.put("unpublishAt", "2030-01-01T00:00:00Z");
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"), pub), teacher))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.unpublishAt").value("must be after the publication date"));
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"), pub), teacher)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(jsonPath("$.errors.unpublishAt").value("muss nach dem Veröffentlichungsdatum liegen"));
        mvc.perform(auth(get("/api/instructor/courses/" + java.util.UUID.randomUUID()), teacher)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"))
                .andExpect(jsonPath("$.detail").value("Kurs nicht gefunden."));
    }

    @Test
    void userLocaleIsStoredAndChangeable() throws Exception {
        String email = uniqueEmail("sprache");
        mvc.perform(jsonBody(post("/api/auth/register"), Map.of("fullName", "Lena", "email", email,
                        "password", PASSWORD, "role", "STUDENT")).header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email))));
        String token = login(email);
        mvc.perform(auth(get("/api/users/me"), token)).andExpect(jsonPath("$.locale").value("de"));
        mvc.perform(auth(jsonBody(put("/api/users/me/locale"), Map.of("locale", "en")), token))
                .andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/users/me"), token)).andExpect(jsonPath("$.locale").value("en"));
        mvc.perform(auth(jsonBody(put("/api/users/me/locale"), Map.of("locale", "fr")), token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.locale").exists());

        // explicit locale wins over the header
        String email2 = uniqueEmail("explicit");
        mvc.perform(jsonBody(post("/api/auth/register"), Map.of("fullName", "Tom", "email", email2,
                        "password", PASSWORD, "role", "STUDENT", "locale", "de")))
                .andExpect(status().isCreated());
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email2))));
        mvc.perform(auth(get("/api/users/me"), login(email2))).andExpect(jsonPath("$.locale").value("de"));
    }

    @Test
    void notificationsAndEmailsUseTheRecipientLanguage() throws Exception {
        String deEmail = uniqueEmail("de-user");
        String enEmail = uniqueEmail("en-user");
        String deToken = signUp(deEmail, "STUDENT");
        String enToken = signUp(enEmail, "STUDENT");
        tx.executeWithoutResult(s -> users.findByEmailIgnoreCase(deEmail).orElseThrow().setLocale("de"));

        tx.executeWithoutResult(s -> {
            var de = users.findByEmailIgnoreCase(deEmail).orElseThrow();
            var en = users.findByEmailIgnoreCase(enEmail).orElseThrow();
            notifications.notify(de, NotificationType.ENROLLMENT_REJECTED, "notification.enrollmentRejected",
                    "/courses", "Kurs ist voll", "Deutsch A1");
            notifications.notify(en, NotificationType.ENROLLMENT_REJECTED, "notification.enrollmentRejected",
                    "/courses", "Course is full", "German A1");

            EmailTemplates.Email deMail = templates.enrollmentApproved(de, "Deutsch A1", "http://x/learn");
            assertThat(deMail.subject()).isEqualTo("Du bist dabei: „Deutsch A1“");
            assertThat(deMail.html()).contains("<html lang=\"de\">").contains("Jetzt loslernen")
                    .contains("Dein Weg zur deutschen Sprache");
            EmailTemplates.Email enMail = templates.enrollmentApproved(en, "German A1", "http://x/learn");
            assertThat(enMail.subject()).isEqualTo("You are in: \"German A1\"");
            assertThat(enMail.html()).contains("<html lang=\"en\">").contains("Start learning");
            assertThat(enMail.text()).startsWith("Hello Test STUDENT,");
        });

        mvc.perform(auth(get("/api/notifications"), deToken))
                .andExpect(jsonPath("$.content[0].title").value("Bewerbung abgelehnt"))
                .andExpect(jsonPath("$.content[0].body")
                        .value("Deine Bewerbung für „Deutsch A1“ wurde abgelehnt. Begründung: Kurs ist voll"));
        mvc.perform(auth(get("/api/notifications"), enToken)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "de")) // the request language does not matter
                .andExpect(jsonPath("$.content[0].title").value("Application rejected"))
                .andExpect(jsonPath("$.content[0].body")
                        .value("Your application for \"German A1\" was rejected. Reason: Course is full"));
        assertThat(List.of(deToken, enToken)).allMatch(t -> !t.isBlank());
    }
}
