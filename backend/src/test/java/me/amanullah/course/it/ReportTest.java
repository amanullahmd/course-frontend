package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Instructor reports: a course with a lesson, a quiz and an exam, two approved learners with attempts and one pending
 * application. Checks overview, gradebook, learner report, assessment analytics, CSV exports and access rules.
 */
class ReportTest extends IntegrationTestSupport {

    private String teacher;
    private String otherTeacher;
    private String anna;
    private String max;
    private String annaId;
    private String maxId;
    private String courseId;
    private String slug;
    private String textId;
    private String quizId;
    private String examId;
    private String annaExamAttempt;

    private String register(String name, String role) throws Exception {
        String email = uniqueEmail(role.toLowerCase());
        mvc.perform(jsonBody(post("/api/auth/register"),
                        Map.of("fullName", name, "email", email, "password", PASSWORD, "role", role)))
                .andExpect(status().isCreated());
        mvc.perform(jsonBody(post("/api/auth/verify-email"), Map.of("token", verificationToken(email))))
                .andExpect(status().isOk());
        return login(email);
    }

    private String me(String token) throws Exception {
        return read(mvc.perform(auth(get("/api/users/me"), token)).andReturn(), "$.id");
    }

    private String item(String moduleId, String type, String title) throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("title", title);
        m.put("body", "<p>x</p>");
        m.put("attachmentIds", List.of());
        String id = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"), m), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        publish("/api/instructor/items/" + id);
        return id;
    }

    private void publish(String base) throws Exception {
        Map<String, Object> p = new HashMap<>();
        p.put("publishStatus", "PUBLISHED");
        mvc.perform(auth(jsonBody(put(base + "/publication"), p), teacher)).andExpect(status().isOk());
    }

    private String enroll(String student) throws Exception {
        return read(mvc.perform(auth(jsonBody(post("/api/student/courses/" + courseId + "/enrollments"), Map.of()),
                student)).andExpect(status().isCreated()).andReturn(), "$.id");
    }

    /** Starts an attempt and submits answers chosen by prompt: option text(s) or a text answer. */
    @SuppressWarnings("unchecked")
    private String attempt(String student, String itemId, Map<String, Object> byPrompt) throws Exception {
        MvcResult session = mvc.perform(auth(post("/api/student/items/" + itemId + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
        String id = read(session, "$.id");
        List<Map<String, Object>> questions = read(session, "$.questions");
        List<Map<String, Object>> answers = new java.util.ArrayList<>();
        for (Map<String, Object> q : questions) {
            Object wanted = byPrompt.get((String) q.get("prompt"));
            if (wanted instanceof List<?> texts) {
                List<Object> ids = ((List<Map<String, Object>>) q.get("options")).stream()
                        .filter(o -> texts.contains(o.get("text"))).map(o -> o.get("id")).toList();
                answers.add(Map.of("questionId", q.get("id"), "selectedOptionIds", ids));
            } else if (wanted instanceof String text) {
                answers.add(Map.of("questionId", q.get("id"), "textAnswer", text));
            }
        }
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + id + "/submit"), Map.of("answers", answers)), student))
                .andExpect(status().isOk());
        return id;
    }

    @BeforeEach
    void seed() throws Exception {
        teacher = register("Anna Lehrerin", "INSTRUCTOR");
        otherTeacher = register("Bernd Fremd", "INSTRUCTOR");
        anna = register("Anna Apfel", "STUDENT");
        max = register("Müller, \"Max\"", "STUDENT");
        String clara = register("Clara Wartend", "STUDENT");
        annaId = me(anna);
        maxId = me(max);

        MvcResult created = mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Deutsch A1 Bericht", "level", "A1", "tags", List.of(), "enrollmentMode", "APPROVAL")), teacher))
                .andExpect(status().isCreated()).andReturn();
        courseId = read(created, "$.id");
        slug = read(created, "$.slug");
        publish("/api/instructor/courses/" + courseId);
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "Modul 1")), teacher)).andExpect(status().isCreated()).andReturn(), "$.id");
        publish("/api/instructor/modules/" + moduleId);
        textId = item(moduleId, "TEXT", "Begrüßung");
        quizId = item(moduleId, "QUIZ", "Quiz 1");
        examId = item(moduleId, "EXAM", "Abschlussprüfung");

        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quizId + "/assessment"), Map.of(
                "passingScore", 60, "questions", List.of(
                        Map.of("type", "SINGLE_CHOICE", "prompt", "<p>Guten <b>Morgen</b>?</p>", "points", 1,
                                "options", List.of(Map.of("text", "Morgen", "correct", true),
                                        Map.of("text", "Nacht", "correct", false))),
                        Map.of("type", "MULTIPLE_CHOICE", "prompt", "Feminin?", "points", 2, "options", List.of(
                                Map.of("text", "Lampe", "correct", true), Map.of("text", "Tisch", "correct", false),
                                Map.of("text", "Frau", "correct", true))),
                        Map.of("type", "SHORT_ANSWER", "prompt", "21 in Worten", "points", 1,
                                "acceptedAnswers", List.of("einundzwanzig"))))), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + examId + "/assessment"), Map.of(
                "passingScore", 50, "questions", List.of(
                        Map.of("type", "SINGLE_CHOICE", "prompt", "Ja?", "points", 1,
                                "options", List.of(Map.of("text", "Ja", "correct", true),
                                        Map.of("text", "Nein", "correct", false))),
                        Map.of("type", "ESSAY", "prompt", "Stell dich vor.", "points", 4)))), teacher))
                .andExpect(status().isOk());

        for (String s : List.of(anna, max)) {
            String e = enroll(s);
            mvc.perform(auth(post("/api/instructor/enrollments/" + e + "/approve"), teacher)).andExpect(status().isOk());
        }
        enroll(clara); // stays pending

        mvc.perform(auth(post("/api/student/items/" + textId + "/complete"), anna)).andExpect(status().isNoContent());
        attempt(anna, quizId, Map.of("<p>Guten <b>Morgen</b>?</p>", List.of("Morgen"),
                "Feminin?", List.of("Lampe", "Frau"), "21 in Worten", "einundzwanzig"));
        annaExamAttempt = attempt(anna, examId, Map.of("Ja?", List.of("Ja"), "Stell dich vor.", "Ich bin Anna."));
        attempt(max, quizId, Map.of("<p>Guten <b>Morgen</b>?</p>", List.of("Nacht"),
                "Feminin?", List.of("Lampe", "Frau"), "21 in Worten", "zwanzig"));
    }

    @Test
    void overviewKpisDistributionModulesFunnelTimelineAndEngagement() throws Exception {
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/overview"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.course.slug").value(slug))
                .andExpect(jsonPath("$.kpis.approvedLearners").value(2))
                .andExpect(jsonPath("$.kpis.pendingApplications").value(1))
                .andExpect(jsonPath("$.kpis.totalLiveItems").value(3))
                // Anna 3/3 = 100, Max 1/3 = 33
                .andExpect(jsonPath("$.kpis.averageProgress").value(66.5))
                .andExpect(jsonPath("$.kpis.medianProgress").value(66.5))
                .andExpect(jsonPath("$.kpis.completionRate").value(50.0))
                .andExpect(jsonPath("$.kpis.completedLearners").value(1))
                .andExpect(jsonPath("$.kpis.assessments").value(2))
                .andExpect(jsonPath("$.kpis.averageBestScore").value(75.0))
                .andExpect(jsonPath("$.kpis.passRate").value(50.0))
                .andExpect(jsonPath("$.kpis.pendingGrading").value(1))
                .andExpect(jsonPath("$.kpis.activeLearners7d").value(2))
                .andExpect(jsonPath("$.progressDistribution[0].count").value(0))
                .andExpect(jsonPath("$.progressDistribution[1].count").value(1))
                .andExpect(jsonPath("$.progressDistribution[4].label").value("100"))
                .andExpect(jsonPath("$.progressDistribution[4].count").value(1))
                .andExpect(jsonPath("$.modules[0].title").value("Modul 1"))
                .andExpect(jsonPath("$.modules[0].itemCount").value(3))
                .andExpect(jsonPath("$.modules[0].completionPercent").value(66.7))
                .andExpect(jsonPath("$.funnel.applied").value(3))
                .andExpect(jsonPath("$.funnel.approved").value(2))
                .andExpect(jsonPath("$.funnel.pending").value(1))
                .andExpect(jsonPath("$.funnel.rejected").value(0))
                .andExpect(jsonPath("$.funnel.approvalRate").value(100.0))
                // course created this week → a single week bucket with all applications and approvals
                .andExpect(jsonPath("$.enrollmentTimeline.length()").value(1))
                .andExpect(jsonPath("$.enrollmentTimeline[0].applications").value(3))
                .andExpect(jsonPath("$.enrollmentTimeline[0].approvals").value(2))
                // content funnel in outline order
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].title").value("Begrüßung"))
                .andExpect(jsonPath("$.items[0].completed").value(1))
                .andExpect(jsonPath("$.items[0].completedPercent").value(50.0))
                .andExpect(jsonPath("$.items[0].taken").doesNotExist())
                .andExpect(jsonPath("$.items[1].completed").value(2))
                .andExpect(jsonPath("$.items[1].taken").value(2))
                .andExpect(jsonPath("$.items[1].takenPercent").value(100.0))
                .andExpect(jsonPath("$.items[1].passed").value(1))
                .andExpect(jsonPath("$.items[1].averagePercent").value(75.0))
                .andExpect(jsonPath("$.items[2].taken").value(1))
                .andExpect(jsonPath("$.items[2].passed").value(0))
                .andExpect(jsonPath("$.items[2].averagePercent").doesNotExist());
    }

    @Test
    void gradebookRowsCellsAndColumnStats() throws Exception {
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/gradebook"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns.length()").value(2))
                .andExpect(jsonPath("$.columns[0].itemId").value(quizId))
                .andExpect(jsonPath("$.columns[0].type").value("QUIZ"))
                .andExpect(jsonPath("$.columns[0].maxScore").value(4))
                .andExpect(jsonPath("$.columns[0].passingScore").value(60))
                .andExpect(jsonPath("$.columns[0].stats.average").value(75.0))
                .andExpect(jsonPath("$.columns[0].stats.median").value(75.0))
                .andExpect(jsonPath("$.columns[0].stats.min").value(50.0))
                .andExpect(jsonPath("$.columns[0].stats.max").value(100.0))
                .andExpect(jsonPath("$.columns[0].stats.passRate").value(50.0))
                .andExpect(jsonPath("$.columns[0].stats.attempts").value(2))
                .andExpect(jsonPath("$.columns[1].type").value("EXAM"))
                .andExpect(jsonPath("$.columns[1].stats.graded").value(0))
                .andExpect(jsonPath("$.columns[1].stats.pendingGrading").value(1))
                // rows sorted by name: "Anna Apfel", "Müller, \"Max\""
                .andExpect(jsonPath("$.rows.length()").value(2))
                .andExpect(jsonPath("$.rows[0].id").value(annaId))
                .andExpect(jsonPath("$.rows[0].progressPercent").value(100))
                .andExpect(jsonPath("$.rows[0].completedItems").value(3))
                .andExpect(jsonPath("$.rows[0].totalLiveItems").value(3))
                .andExpect(jsonPath("$.rows[0].lessonsCompleted").value(1))
                .andExpect(jsonPath("$.rows[0].lessonsTotal").value(1))
                .andExpect(jsonPath("$.rows[0].quizzesTaken").value(1))
                .andExpect(jsonPath("$.rows[0].quizzesTotal").value(1))
                .andExpect(jsonPath("$.rows[0].examsTaken").value(1))
                .andExpect(jsonPath("$.rows[0].examsTotal").value(1))
                .andExpect(jsonPath("$.rows[0].averageQuizPercent").value(100.0))
                .andExpect(jsonPath("$.rows[0].averageExamPercent").doesNotExist())
                .andExpect(jsonPath("$.rows[0].activity").value("COMPLETED"))
                .andExpect(jsonPath("$.rows[0].lastActivityAt").exists())
                .andExpect(jsonPath("$.rows[0].averagePercent").value(100.0))
                .andExpect(jsonPath("$.rows[0].cells[0].status").value("GRADED"))
                .andExpect(jsonPath("$.rows[0].cells[0].bestPercent").value(100.0))
                .andExpect(jsonPath("$.rows[0].cells[0].bestScore").value(4.0))
                .andExpect(jsonPath("$.rows[0].cells[0].passed").value(true))
                .andExpect(jsonPath("$.rows[0].cells[0].attempts").value(1))
                .andExpect(jsonPath("$.rows[0].cells[1].status").value("SUBMITTED_PENDING"))
                .andExpect(jsonPath("$.rows[0].cells[1].latestAttemptId").value(annaExamAttempt))
                .andExpect(jsonPath("$.rows[0].cells[1].bestPercent").doesNotExist())
                .andExpect(jsonPath("$.rows[1].id").value(maxId))
                .andExpect(jsonPath("$.rows[1].progressPercent").value(33))
                .andExpect(jsonPath("$.rows[1].lessonsCompleted").value(0))
                .andExpect(jsonPath("$.rows[1].examsTaken").value(0))
                .andExpect(jsonPath("$.rows[1].activity").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.rows[1].cells[0].bestPercent").value(50.0))
                .andExpect(jsonPath("$.rows[1].cells[0].passed").value(false))
                .andExpect(jsonPath("$.rows[1].cells[1].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.rows[1].cells[1].attempts").value(0));

        // grading the essay turns the exam cell into GRADED: (1 + 3) / 5 = 80 %
        String essayId = read(mvc.perform(auth(get("/api/instructor/attempts/" + annaExamAttempt), teacher))
                .andReturn(), "$.answers[1].questionId");
        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + annaExamAttempt + "/grade"),
                Map.of("grades", List.of(Map.of("questionId", essayId, "pointsAwarded", 3, "feedback", "Gut!")))),
                teacher)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/gradebook"), teacher))
                .andExpect(jsonPath("$.rows[0].cells[1].status").value("GRADED"))
                .andExpect(jsonPath("$.rows[0].cells[1].bestPercent").value(80.0))
                .andExpect(jsonPath("$.rows[0].averageExamPercent").value(80.0))
                .andExpect(jsonPath("$.rows[0].averagePercent").value(90.0))
                .andExpect(jsonPath("$.columns[1].stats.passRate").value(100.0));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/" + annaId), teacher))
                .andExpect(jsonPath("$.feedbackCount").value(1))
                .andExpect(jsonPath("$.totals.pendingGrading").value(0))
                .andExpect(jsonPath("$.totals.assessmentsPassed").value(2));
    }

    @Test
    void learnerReport() throws Exception {
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/" + maxId), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.student.fullName").value("Müller, \"Max\""))
                .andExpect(jsonPath("$.enrollment.status").value("APPROVED"))
                .andExpect(jsonPath("$.enrollment.appliedAt").exists())
                .andExpect(jsonPath("$.enrollment.decidedAt").exists())
                .andExpect(jsonPath("$.progressPercent").value(33))
                .andExpect(jsonPath("$.completedItems").value(1))
                .andExpect(jsonPath("$.modules[0].items.length()").value(3))
                .andExpect(jsonPath("$.modules[0].items[0].completedAt").doesNotExist())
                .andExpect(jsonPath("$.modules[0].items[1].completedAt").exists())
                .andExpect(jsonPath("$.attempts.length()").value(1))
                .andExpect(jsonPath("$.attempts[0].itemTitle").value("Quiz 1"))
                .andExpect(jsonPath("$.attempts[0].status").value("GRADED"))
                .andExpect(jsonPath("$.attempts[0].score").value(2.0))
                .andExpect(jsonPath("$.attempts[0].percent").value(50.0))
                .andExpect(jsonPath("$.attempts[0].passed").value(false))
                .andExpect(jsonPath("$.attempts[0].late").value(false))
                .andExpect(jsonPath("$.attempts[0].autoSubmitted").value(false))
                .andExpect(jsonPath("$.totals.attempts").value(1))
                .andExpect(jsonPath("$.totals.assessmentsAttempted").value(1))
                .andExpect(jsonPath("$.totals.assessmentsPassed").value(0))
                .andExpect(jsonPath("$.totals.assessments").value(2))
                .andExpect(jsonPath("$.totals.averageBestPercent").value(50.0))
                .andExpect(jsonPath("$.feedbackCount").value(0));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/" + annaId), teacher))
                .andExpect(jsonPath("$.attempts.length()").value(2))
                .andExpect(jsonPath("$.attempts[1].status").value("SUBMITTED"))
                .andExpect(jsonPath("$.attempts[1].pendingManualGrading").value(true))
                .andExpect(jsonPath("$.attempts[1].passed").doesNotExist())
                .andExpect(jsonPath("$.totals.pendingGrading").value(1));
    }

    @Test
    void assessmentAnalytics() throws Exception {
        mvc.perform(auth(get("/api/instructor/items/" + quizId + "/reports/assessment"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attempts").value(2))
                .andExpect(jsonPath("$.uniqueLearners").value(2))
                .andExpect(jsonPath("$.gradedAttempts").value(2))
                .andExpect(jsonPath("$.averagePercent").value(75.0))
                .andExpect(jsonPath("$.medianPercent").value(75.0))
                .andExpect(jsonPath("$.averageScore").value(3.0))
                .andExpect(jsonPath("$.passRate").value(50.0))
                .andExpect(jsonPath("$.averageDurationSeconds").exists())
                .andExpect(jsonPath("$.scoreDistribution.length()").value(10))
                .andExpect(jsonPath("$.scoreDistribution[5].label").value("50-60"))
                .andExpect(jsonPath("$.scoreDistribution[5].count").value(1))
                .andExpect(jsonPath("$.scoreDistribution[9].count").value(1))
                .andExpect(jsonPath("$.scoreDistribution[0].count").value(0))
                .andExpect(jsonPath("$.questions.length()").value(3))
                .andExpect(jsonPath("$.questions[0].prompt").value("Guten Morgen?"))
                .andExpect(jsonPath("$.questions[0].type").value("SINGLE_CHOICE"))
                .andExpect(jsonPath("$.questions[0].percentCorrect").value(50.0))
                .andExpect(jsonPath("$.questions[0].averagePoints").value(0.5))
                .andExpect(jsonPath("$.questions[0].commonWrongAnswers[0].text").value("Nacht"))
                .andExpect(jsonPath("$.questions[0].commonWrongAnswers[0].count").value(1))
                .andExpect(jsonPath("$.questions[1].percentCorrect").value(100.0))
                .andExpect(jsonPath("$.questions[1].commonWrongAnswers.length()").value(0))
                .andExpect(jsonPath("$.questions[2].percentCorrect").value(50.0))
                .andExpect(jsonPath("$.questions[2].commonWrongAnswers[0].text").value("zwanzig"))
                .andExpect(jsonPath("$.questions[2].unanswered").value(0));
        mvc.perform(auth(get("/api/instructor/items/" + examId + "/reports/assessment"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attempts").value(1))
                .andExpect(jsonPath("$.gradedAttempts").value(0))
                .andExpect(jsonPath("$.pendingGrading").value(1))
                .andExpect(jsonPath("$.averagePercent").doesNotExist())
                .andExpect(jsonPath("$.questions[1].type").value("ESSAY"))
                .andExpect(jsonPath("$.questions[1].percentCorrect").doesNotExist());
    }

    private String csv(MvcResult r) {
        byte[] body = r.getResponse().getContentAsByteArray();
        assertThat(body).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        return new String(body, 3, body.length - 3, StandardCharsets.UTF_8);
    }

    @Test
    void csvExports() throws Exception {
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        MvcResult r = mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/gradebook.csv"), teacher))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("text/csv")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        containsString("attachment; filename=\"gradebook-" + slug + "-" + today + ".csv\"")))
                .andReturn();
        String body = csv(r);
        String[] lines = body.split("\r\n");
        assertThat(lines).hasSize(3);
        assertThat(lines[0]).startsWith("Name,Email,Progress (%),Completed items,Last activity (UTC),Average (%),"
                + "Quiz 1 (%),Quiz 1 – Status,Quiz 1 – Attempts,Abschlussprüfung (%)");
        assertThat(lines[1]).startsWith("Anna Apfel,").contains(",100,3/3,").contains(",100,Graded,1,,Awaiting grading,1");
        assertThat(lines[2]).startsWith("\"Müller, \"\"Max\"\"\",").contains(",33,1/3,").endsWith(",50,Graded,1,,Not started,0");

        // German headers
        String de = csv(mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/gradebook.csv"), teacher)
                .header(HttpHeaders.ACCEPT_LANGUAGE, "de-DE")).andExpect(status().isOk()).andReturn());
        assertThat(de).startsWith("Name,E-Mail,Fortschritt (%),Erledigte Inhalte,Letzte Aktivität (UTC),Durchschnitt (%)")
                .contains("Wartet auf Bewertung").contains("Nicht begonnen");

        // progress table
        String progress = csv(mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/progress.csv"),
                teacher)).andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("progress-" + slug)))
                .andReturn());
        String[] p = progress.split("\r\n");
        assertThat(p[0]).contains("Activity,Progress (%),Completed items,Lessons & exercises,Quizzes taken,Exams taken")
                .endsWith("Quiz 1 (Quiz),Abschlussprüfung (Exam)");
        assertThat(p[1]).contains(",Completed,100,3/3,1/1,1/1,1/1,100,,").endsWith(",100 %,Awaiting grading");
        assertThat(p[2]).contains(",In progress,33,1/3,0/1,1/1,0/1,50,,").endsWith(",50 %,Not started");

        // attempts with per-question points
        String attempts = csv(mvc.perform(auth(get("/api/instructor/items/" + quizId + "/reports/attempts.csv"), teacher)
                .header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attempts-" + slug + "-quiz-1-")))
                .andReturn());
        String[] a = attempts.split("\r\n");
        assertThat(a).hasSize(3);
        assertThat(a[0]).startsWith("Name,E-Mail,Versuch,Status,Begonnen (UTC),Abgegeben (UTC),Dauer (Min.),Punkte,")
                .endsWith("F1 (1 Pkt.) Guten Morgen?,F2 (2 Pkt.) Feminin?,F3 (1 Pkt.) 21 in Worten");
        assertThat(attempts).contains("Anna Apfel,").contains(",4,4,100,Ja,Nein,Nein,1,2,1")
                .contains(",2,4,50,Nein,Nein,Nein,0,2,0");

        // learner report
        String learner = csv(mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/" + maxId
                        + ".csv"), teacher))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("learner-" + slug + "-mueller-max-")))
                .andReturn());
        String[] l = learner.split("\r\n");
        assertThat(l[0]).startsWith("Section,Module,Item,Type,Completed (UTC),Status");
        assertThat(l[1]).startsWith("Learner,\"Müller, \"\"Max\"\"\",");
        assertThat(learner).contains("Progress,Modul 1,Begrüßung,TEXT,,Open").contains("Attempt,,Quiz 1,QUIZ,,Graded,");
    }

    @Test
    void accessRulesAndBadIds() throws Exception {
        List<String> paths = List.of(
                "/api/instructor/courses/" + courseId + "/reports/overview",
                "/api/instructor/courses/" + courseId + "/reports/gradebook",
                "/api/instructor/courses/" + courseId + "/reports/gradebook.csv",
                "/api/instructor/courses/" + courseId + "/reports/progress.csv",
                "/api/instructor/courses/" + courseId + "/reports/students/" + maxId,
                "/api/instructor/courses/" + courseId + "/reports/students/" + maxId + ".csv",
                "/api/instructor/items/" + quizId + "/reports/assessment",
                "/api/instructor/items/" + quizId + "/reports/attempts.csv");
        for (String path : paths) {
            mvc.perform(auth(get(path), otherTeacher)).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").exists());
            mvc.perform(auth(get(path), max)).andExpect(status().isForbidden());
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        String unknown = UUID.randomUUID().toString();
        mvc.perform(auth(get("/api/instructor/courses/" + unknown + "/reports/overview"), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        mvc.perform(auth(get("/api/instructor/courses/" + unknown + "/reports/gradebook.csv"), teacher)
                        .header(HttpHeaders.ACCEPT, "text/csv"))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get("/api/instructor/courses/not-a-uuid/reports/gradebook"), teacher))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/nope.csv"), teacher))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/instructor/courses/" + courseId + "/reports/students/" + unknown), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ENROLLMENT_NOT_FOUND"));
        mvc.perform(auth(get("/api/instructor/items/" + textId + "/reports/assessment"), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_FOUND"));
        mvc.perform(auth(get("/api/instructor/items/" + textId + "/reports/attempts.csv"), teacher))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get("/api/instructor/items/" + unknown + "/reports/assessment"), teacher))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ITEM_NOT_FOUND"));
        mvc.perform(auth(post("/api/instructor/courses/" + courseId + "/reports/overview"), teacher))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void emptyCourse() throws Exception {
        String empty = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Leer", "level", "A1", "tags", List.of(), "enrollmentMode", "OPEN")), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        mvc.perform(auth(get("/api/instructor/courses/" + empty + "/reports/overview"), teacher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis.approvedLearners").value(0))
                .andExpect(jsonPath("$.kpis.averageProgress").doesNotExist())
                .andExpect(jsonPath("$.funnel.approvalRate").doesNotExist())
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(auth(get("/api/instructor/courses/" + empty + "/reports/gradebook"), teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rows.length()").value(0));
        String body = csv(mvc.perform(auth(get("/api/instructor/courses/" + empty + "/reports/gradebook.csv"), teacher))
                .andExpect(status().isOk()).andReturn());
        assertThat(body.split("\r\n")).hasSize(1);
    }
}
