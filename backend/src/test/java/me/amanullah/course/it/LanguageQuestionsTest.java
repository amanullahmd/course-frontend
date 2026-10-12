package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Language question types: authoring validation, attempt flow with autosave/resume/auto-submit, answer snapshots,
 * speaking answers with manual grading, key leakage and bad-input robustness.
 */
class LanguageQuestionsTest extends IntegrationTestSupport {

    @Autowired
    private JdbcTemplate jdbc;

    private static final byte[] WAV = ("RIFF\u0000\u0000\u0000\u0000WAVEfmt ").getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
    private static final byte[] WEBM = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    private record Quiz(String teacher, String courseId, String itemId, String audioId) {
    }

    // ------------------------------------------------------------------ setup

    private Map<String, Object> publication() {
        Map<String, Object> m = new HashMap<>();
        m.put("publishStatus", "PUBLISHED");
        m.put("publishAt", null);
        m.put("unpublishAt", null);
        return m;
    }

    private String upload(String token, String name, String type, byte[] bytes) throws Exception {
        MvcResult r = mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", name, type, bytes))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)).andExpect(status().isCreated()).andReturn();
        return read(r, "$.id");
    }

    private static Map<String, Object> opt(String text, Boolean correct, String matchText, Integer blank) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("text", text);
        o.put("correct", correct);
        if (matchText != null) {
            o.put("matchText", matchText);
        }
        if (blank != null) {
            o.put("blankIndex", blank);
        }
        return o;
    }

    private static Map<String, Object> blank(int index, String... answers) {
        return Map.of("index", index, "acceptedAnswers", List.of(answers));
    }

    private Map<String, Object> clozeQuestion(String audioId) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "CLOZE");
        q.put("prompt", "Ich {{1}} gestern im Kino und {{2}} einen Film gesehen.");
        q.put("points", 4);
        q.put("scoring", "PARTIAL");
        q.put("lenientSpelling", true);
        q.put("blanks", List.of(blank(1, "war", "bin gewesen"), blank(2, "habe")));
        return q;
    }

    private Map<String, Object> wordBankQuestion() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "WORD_BANK");
        q.put("prompt", "Das Mädchen {{1}} nach Berlin und {{2}} Deutsch.");
        q.put("points", 2);
        q.put("scoring", "PARTIAL");
        q.put("shuffleOptions", true);
        q.put("options", List.of(opt("fährt", true, null, 1), opt("lernt", true, null, 2),
                opt("fahren", false, null, null), opt("lernen", false, null, null)));
        return q;
    }

    private Map<String, Object> matchingQuestion() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "MATCHING");
        q.put("prompt", "Ordne die Artikel zu.");
        q.put("points", 4);
        q.put("scoring", "PARTIAL");
        q.put("options", List.of(opt("Tisch", false, "der", null), opt("Lampe", false, "die", null),
                opt("Zeitung", false, "die", null), opt("Kind", false, "das", null)));
        return q;
    }

    private Map<String, Object> orderingQuestion() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "ORDERING");
        q.put("prompt", "Bringe die Wörter in die richtige Reihenfolge.");
        q.put("points", 4);
        q.put("scoring", "PARTIAL");
        q.put("options", List.of(opt("Morgen", false, null, null), opt("fahre", false, null, null),
                opt("ich", false, null, null), opt("nach Hamburg", false, null, null)));
        return q;
    }

    private Map<String, Object> dictationQuestion(String audioId) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "DICTATION");
        q.put("prompt", "Höre zu und schreibe.");
        q.put("points", 4);
        q.put("scoring", "PARTIAL");
        q.put("lenientSpelling", true);
        q.put("mediaId", audioId);
        q.put("acceptedAnswers", List.of("Das Mädchen trinkt gern Tee."));
        return q;
    }

    private Map<String, Object> speakingQuestion() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", "SPEAKING");
        q.put("prompt", "Stell dich vor.");
        q.put("points", 5);
        q.put("maxRecordingSeconds", 60);
        return q;
    }

    private Quiz quiz(boolean showCorrect, Integer timeLimit) throws Exception {
        String teacher = signUp(uniqueEmail("lang-teacher"), "INSTRUCTOR");
        String courseId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses"), Map.of(
                "title", "Sprachkurs", "level", "A1", "enrollmentMode", "OPEN")), teacher)).andReturn(), "$.id");
        String moduleId = read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + courseId + "/modules"),
                Map.of("title", "M")), teacher)).andReturn(), "$.id");
        String itemId = read(mvc.perform(auth(jsonBody(post("/api/instructor/modules/" + moduleId + "/items"),
                Map.of("type", timeLimit == null ? "QUIZ" : "EXAM", "title", "Übungen")), teacher))
                .andExpect(status().isCreated()).andReturn(), "$.id");
        String audioId = upload(teacher, "diktat.wav", "audio/wav", WAV);
        Map<String, Object> assessment = new HashMap<>();
        assessment.put("timeLimitMinutes", timeLimit);
        assessment.put("maxAttempts", 0);
        assessment.put("showCorrectAnswers", showCorrect);
        assessment.put("passingScore", 50);
        assessment.put("questions", List.of(clozeQuestion(audioId), wordBankQuestion(), matchingQuestion(),
                orderingQuestion(), dictationQuestion(audioId), speakingQuestion()));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/assessment"), assessment), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/courses/" + courseId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/modules/" + moduleId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/publication"), publication()), teacher))
                .andExpect(status().isOk());
        return new Quiz(teacher, courseId, itemId, audioId);
    }

    private String student(Quiz quiz) throws Exception {
        String student = signUp(uniqueEmail("lang-student"), "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + quiz.courseId() + "/enrollments"), Map.of()), student))
                .andExpect(jsonPath("$.status").value("APPROVED"));
        return student;
    }

    private MvcResult start(Quiz quiz, String student) throws Exception {
        return mvc.perform(auth(post("/api/student/items/" + quiz.itemId() + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
    }

    private static String questionId(MvcResult session, String type) throws Exception {
        List<String> ids = JsonPath.read(session.getResponse().getContentAsString(),
                "$.questions[?(@.type=='" + type + "')].id");
        return ids.getFirst();
    }

    private static List<Map<String, Object>> options(MvcResult session, String type) throws Exception {
        List<List<Map<String, Object>>> all = JsonPath.read(session.getResponse().getContentAsString(),
                "$.questions[?(@.type=='" + type + "')].options");
        return all.getFirst();
    }

    private static String optionId(List<Map<String, Object>> options, String text) {
        return options.stream().filter(o -> text.equals(o.get("text"))).findFirst().orElseThrow().get("id").toString();
    }

    private Map<String, Object> answer(String questionId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("questionId", questionId);
        return m;
    }

    /** A complete, fully correct answer sheet (without the speaking recording). */
    private List<Map<String, Object>> perfectSheet(MvcResult session, String mediaId) throws Exception {
        List<Map<String, Object>> sheet = new ArrayList<>();
        Map<String, Object> cloze = answer(questionId(session, "CLOZE"));
        cloze.put("blanks", Map.of("1", "bin gewesen", "2", "HABE"));
        sheet.add(cloze);

        List<Map<String, Object>> chips = options(session, "WORD_BANK");
        Map<String, Object> bank = answer(questionId(session, "WORD_BANK"));
        bank.put("blanks", Map.of("1", optionId(chips, "fährt"), "2", optionId(chips, "lernt")));
        sheet.add(bank);

        List<Map<String, Object>> left = options(session, "MATCHING");
        List<List<Map<String, Object>>> targets = JsonPath.read(session.getResponse().getContentAsString(),
                "$.questions[?(@.type=='MATCHING')].matchTargets");
        Map<String, String> pairs = new HashMap<>();
        Map<String, String> articleFor = Map.of("Tisch", "der", "Lampe", "die", "Zeitung", "die", "Kind", "das");
        java.util.Set<String> used = new java.util.HashSet<>();
        for (Map<String, Object> l : left) {
            String article = articleFor.get(l.get("text").toString());
            String rightId = targets.getFirst().stream()
                    .filter(t -> article.equals(t.get("text")) && !used.contains(t.get("id").toString())).findFirst()
                    .orElseThrow().get("id").toString();
            used.add(rightId);
            pairs.put(l.get("id").toString(), rightId);
        }
        Map<String, Object> matching = answer(questionId(session, "MATCHING"));
        matching.put("pairs", pairs);
        sheet.add(matching);

        List<Map<String, Object>> items = options(session, "ORDERING");
        Map<String, Object> ordering = answer(questionId(session, "ORDERING"));
        ordering.put("order", List.of(optionId(items, "Morgen"), optionId(items, "fahre"), optionId(items, "ich"),
                optionId(items, "nach Hamburg")));
        sheet.add(ordering);

        Map<String, Object> dictation = answer(questionId(session, "DICTATION"));
        dictation.put("textAnswer", "das maedchen trinkt gern tee");
        sheet.add(dictation);

        Map<String, Object> speaking = answer(questionId(session, "SPEAKING"));
        speaking.put("responseMediaId", mediaId);
        sheet.add(speaking);
        return sheet;
    }

    private static Object saved(String sessionJson, String questionId, String field) {
        List<Object> found = JsonPath.read(sessionJson, "$.savedAnswers[?(@.questionId=='" + questionId + "')]." + field);
        return found.isEmpty() ? null : found.getFirst();
    }

    private void autosave(String student, String attemptId, List<Map<String, Object>> sheet) throws Exception {
        mvc.perform(auth(jsonBody(put("/api/student/attempts/" + attemptId + "/answers"), Map.of("answers", sheet)),
                student)).andExpect(status().isNoContent());
    }

    private MvcResult submit(String student, String attemptId, List<Map<String, Object>> sheet) throws Exception {
        return mvc.perform(auth(jsonBody(post("/api/student/attempts/" + attemptId + "/submit"), Map.of("answers", sheet)),
                student)).andExpect(status().isOk()).andReturn();
    }

    // ------------------------------------------------------------------ authoring

    @Test
    void authoringRoundTripKeepsAllLanguageFields() throws Exception {
        Quiz quiz = quiz(true, null);
        MvcResult r = mvc.perform(auth(get("/api/instructor/items/" + quiz.itemId() + "/assessment"), quiz.teacher()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(6))
                .andExpect(jsonPath("$.questions[0].type").value("CLOZE"))
                .andExpect(jsonPath("$.questions[0].scoring").value("PARTIAL"))
                .andExpect(jsonPath("$.questions[0].lenientSpelling").value(true))
                .andExpect(jsonPath("$.questions[0].blanks[0].index").value(1))
                .andExpect(jsonPath("$.questions[0].blanks[0].acceptedAnswers[1]").value("bin gewesen"))
                .andExpect(jsonPath("$.questions[0].blanks[1].acceptedAnswers[0]").value("habe"))
                .andExpect(jsonPath("$.questions[1].shuffleOptions").value(true))
                .andExpect(jsonPath("$.questions[1].options[0].blankIndex").value(1))
                .andExpect(jsonPath("$.questions[1].options[2].blankIndex").doesNotExist())
                .andExpect(jsonPath("$.questions[2].options[1].matchText").value("die"))
                .andExpect(jsonPath("$.questions[4].acceptedAnswers[0]").value("Das Mädchen trinkt gern Tee."))
                .andExpect(jsonPath("$.questions[5].maxRecordingSeconds").value(60))
                .andReturn();
        assertThat(r.getResponse().getContentAsString()).contains("{{1}}");
    }

    @Test
    void authoringValidationReportsFieldErrorsPerQuestionIndex() throws Exception {
        Quiz quiz = quiz(true, null);
        String audioId = quiz.audioId();
        String imageId = upload(quiz.teacher(), "bild.png", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3});

        Map<String, Object> noBlank = clozeQuestion(audioId);
        noBlank.put("prompt", "Kein Marker hier");
        Map<String, Object> noAnswer = clozeQuestion(audioId);
        noAnswer.put("blanks", List.of(blank(1, "war")));
        Map<String, Object> dupMarker = clozeQuestion(audioId);
        dupMarker.put("prompt", "{{1}} und {{1}} und {{2}}");
        Map<String, Object> noChip = wordBankQuestion();
        noChip.put("options", List.of(opt("fährt", true, null, 1), opt("x", false, null, null), opt("y", false, null, null)));
        Map<String, Object> oneChipTwice = wordBankQuestion();
        oneChipTwice.put("options", List.of(opt("fährt", true, null, 1), opt("fährt2", true, null, 1),
                opt("lernt", true, null, 2)));
        Map<String, Object> onePair = matchingQuestion();
        onePair.put("options", List.of(opt("Tisch", false, "der", null)));
        Map<String, Object> noRight = matchingQuestion();
        noRight.put("options", List.of(opt("Tisch", false, "der", null), opt("Lampe", false, " ", null)));
        Map<String, Object> oneItem = orderingQuestion();
        oneItem.put("options", List.of(opt("allein", false, null, null)));
        Map<String, Object> dictationNoAudio = dictationQuestion(imageId);
        Map<String, Object> dictationNoMedia = dictationQuestion(null);
        Map<String, Object> dictationNoRef = dictationQuestion(audioId);
        dictationNoRef.put("acceptedAnswers", List.of());
        Map<String, Object> speakingShort = speakingQuestion();
        speakingShort.put("maxRecordingSeconds", 5);
        Map<String, Object> speakingNone = speakingQuestion();
        speakingNone.remove("maxRecordingSeconds");

        List<Map<String, Object>> questions = List.of(noBlank, noAnswer, dupMarker, noChip, oneChipTwice, onePair,
                noRight, oneItem, dictationNoAudio, dictationNoMedia, dictationNoRef, speakingShort, speakingNone);
        Map<String, Object> body = Map.of("questions", questions);

        MvcResult en = mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz.itemId() + "/assessment"), body),
                        quiz.teacher()))
                .andExpect(status().isBadRequest()).andReturn();
        String json = en.getResponse().getContentAsString();
        Map<String, String> errors = JsonPath.read(json, "$.errors");
        assertThat(errors).containsKeys("questions[0].prompt", "questions[1].blanks", "questions[2].prompt",
                "questions[3].options", "questions[4].options", "questions[5].options", "questions[6].options",
                "questions[7].options", "questions[8].mediaId", "questions[9].mediaId",
                "questions[10].acceptedAnswers", "questions[11].maxRecordingSeconds", "questions[12].maxRecordingSeconds");
        assertThat(errors.get("questions[1].blanks")).isEqualTo("blank 2 needs at least one accepted answer");
        assertThat(errors.get("questions[11].maxRecordingSeconds")).contains("between 10 and 600");

        MvcResult de = mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz.itemId() + "/assessment"), body),
                        quiz.teacher()).header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isBadRequest()).andReturn();
        Map<String, String> germanErrors = JsonPath.read(de.getResponse().getContentAsString(), "$.errors");
        assertThat(germanErrors.get("questions[1].blanks")).isEqualTo("Lücke 2 braucht mindestens eine akzeptierte Antwort");
        assertThat(germanErrors.get("questions[7].options")).isEqualTo("braucht mindestens zwei Elemente");

        // nothing was stored by the rejected request
        mvc.perform(auth(get("/api/instructor/items/" + quiz.itemId() + "/assessment"), quiz.teacher()))
                .andExpect(jsonPath("$.questions.length()").value(6));
    }

    @Test
    void unsupportedFlagsAreNormalisedPerType() throws Exception {
        Quiz quiz = quiz(true, null);
        Map<String, Object> single = new LinkedHashMap<>();
        single.put("type", "SINGLE_CHOICE");
        single.put("prompt", "Wähle");
        single.put("scoring", "PARTIAL");
        single.put("shuffleOptions", true);
        single.put("lenientSpelling", true);
        single.put("maxRecordingSeconds", 99);
        single.put("options", List.of(opt("a", true, "ignored", 3), opt("b", false, null, null)));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz.itemId() + "/assessment"),
                        Map.of("questions", List.of(single))), quiz.teacher()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].scoring").value("ALL_OR_NOTHING"))
                .andExpect(jsonPath("$.questions[0].shuffleOptions").value(true))
                .andExpect(jsonPath("$.questions[0].lenientSpelling").value(false))
                .andExpect(jsonPath("$.questions[0].maxRecordingSeconds").doesNotExist())
                .andExpect(jsonPath("$.questions[0].options[0].matchText").doesNotExist())
                .andExpect(jsonPath("$.questions[0].options[0].blankIndex").doesNotExist());
    }

    // ------------------------------------------------------------------ attempt flow

    @Test
    void sessionNeverLeaksTheSolutionAndKeepsTheShuffleAcrossResume() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String body = session.getResponse().getContentAsString();

        // no keys: accepted answers, correct flags, blank assignment, pair texts of the left side
        assertThat(body).doesNotContain("\"correct\"").doesNotContain("blankIndex").doesNotContain("acceptedAnswers")
                .doesNotContain("bin gewesen").doesNotContain("Das Mädchen trinkt gern Tee").doesNotContain("\"explanation\"");
        assertThat(JsonPath.<List<Integer>>read(body, "$.questions[?(@.type=='CLOZE')].blankCount")).containsExactly(2);
        assertThat(JsonPath.<List<Integer>>read(body, "$.questions[?(@.type=='WORD_BANK')].blankCount")).containsExactly(2);
        assertThat(JsonPath.<List<Integer>>read(body, "$.questions[?(@.type=='SPEAKING')].maxRecordingSeconds")).containsExactly(60);
        List<List<Map<String, Object>>> targets = JsonPath.read(body, "$.questions[?(@.type=='MATCHING')].matchTargets");
        assertThat(targets.getFirst()).hasSize(4);
        // MATCHING lists the left texts as options; the right texts only come as shuffled targets with their own ids
        List<Map<String, Object>> left = options(session, "MATCHING");
        assertThat(left).extracting(o -> o.get("text")).containsExactlyInAnyOrder("Tisch", "Lampe", "Zeitung", "Kind");
        assertThat(targets.getFirst()).extracting(t -> t.get("text")).containsExactlyInAnyOrder("der", "die", "die", "das");
        // ORDERING items are not shown in the correct order
        assertThat(options(session, "ORDERING")).extracting(o -> o.get("text"))
                .isNotEqualTo(List.of("Morgen", "fahre", "ich", "nach Hamburg"));

        // resume: same attempt, same option and target order
        MvcResult again = start(quiz, student);
        assertThat(options(again, "ORDERING")).isEqualTo(options(session, "ORDERING"));
        assertThat(options(again, "WORD_BANK")).isEqualTo(options(session, "WORD_BANK"));
        assertThat(JsonPath.<Object>read(again.getResponse().getContentAsString(), "$.questions[?(@.type=='MATCHING')].matchTargets"))
                .isEqualTo(JsonPath.read(body, "$.questions[?(@.type=='MATCHING')].matchTargets"));
    }

    @Test
    void autosaveResumeSubmitAndScore() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        String recording = upload(student, "aufnahme.webm", "audio/webm", WEBM);
        List<Map<String, Object>> sheet = perfectSheet(session, recording);

        // draft with a partly wrong CLOZE; autosave, then resume restores every response
        List<Map<String, Object>> draft = new ArrayList<>(sheet);
        Map<String, Object> halfCloze = answer(questionId(session, "CLOZE"));
        halfCloze.put("blanks", Map.of("1", "war", "2", "hatte", "99", "ignored"));
        draft.set(0, halfCloze);
        autosave(student, attemptId, draft);

        MvcResult resumed = start(quiz, student);
        String body = resumed.getResponse().getContentAsString();
        assertThat((String) read(resumed, "$.id")).isEqualTo(attemptId);
        assertThat(saved(body, questionId(session, "CLOZE"), "blanks")).isInstanceOf(Map.class);
        assertThat((Map<String, String>) saved(body, questionId(session, "CLOZE"), "blanks"))
                .containsEntry("1", "war").containsEntry("2", "hatte").doesNotContainKey("99");
        assertThat((List<String>) saved(body, questionId(session, "ORDERING"), "order")).hasSize(4);
        assertThat(saved(body, questionId(session, "SPEAKING"), "responseMediaId")).isEqualTo(recording);
        assertThat(((Map<String, Object>) saved(body, questionId(session, "SPEAKING"), "responseMedia")).get("url").toString())
                .startsWith("http");

        // submit the perfect sheet: everything auto-graded is right, speaking is pending
        MvcResult result = submit(student, attemptId, sheet);
        String json = result.getResponse().getContentAsString();
        assertThat((String) JsonPath.read(json, "$.status")).isEqualTo("SUBMITTED");
        assertThat((Boolean) JsonPath.read(json, "$.pendingManualGrading")).isTrue();
        assertThat((Double) JsonPath.read(json, "$.score")).isEqualTo(18.0);
        assertThat((Double) JsonPath.read(json, "$.maxScore")).isEqualTo(23.0);
        assertThat((List<Boolean>) JsonPath.read(json, "$.answers[*].correct")).containsExactly(true, true, true, true, true, null);
        assertThat((List<Boolean>) JsonPath.read(json, "$.answers[0].blankResults[*].correct")).containsExactly(true, true);
        assertThat((List<String>) JsonPath.read(json, "$.answers[0].blankResults[0].expected")).contains("war", "bin gewesen");
        assertThat((List<Boolean>) JsonPath.read(json, "$.answers[2].pairResults[*].correct")).containsOnly(true);
        assertThat((String) JsonPath.read(json, "$.answers[5].responseMedia.id")).isEqualTo(recording);
        assertThat((List<String>) JsonPath.read(json, "$.answers[3].correctOrder")).hasSize(4);
        assertThat((List<String>) JsonPath.read(json, "$.answers[4].acceptedAnswers")).containsExactly("Das Mädchen trinkt gern Tee.");

        // a second submit is refused
        mvc.perform(auth(jsonBody(post("/api/student/attempts/" + attemptId + "/submit"), Map.of("answers", sheet)), student))
                .andExpect(status().isConflict());
    }

    @Test
    void partialAnswersEarnPartialCredit() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        List<Map<String, Object>> sheet = new ArrayList<>(perfectSheet(session, upload(student, "a.webm", "audio/webm", WEBM)));
        Map<String, Object> cloze = answer(questionId(session, "CLOZE"));
        cloze.put("blanks", Map.of("1", "war", "2", "wrong"));           // 1 of 2 -> 2 of 4
        sheet.set(0, cloze);
        List<Map<String, Object>> items = options(session, "ORDERING");
        Map<String, Object> ordering = answer(questionId(session, "ORDERING"));
        ordering.put("order", List.of(optionId(items, "fahre"), optionId(items, "Morgen"), optionId(items, "ich"),
                optionId(items, "nach Hamburg")));                            // LCS 3 of 4 -> 3 of 4
        sheet.set(3, ordering);
        Map<String, Object> dictation = answer(questionId(session, "DICTATION"));
        dictation.put("textAnswer", "Das Mädchen trinkt Tee");              // one word missing of five -> 3.0 (0.8 * 4 = 3.2 -> 3)
        sheet.set(4, dictation);
        sheet.remove(5);                                                      // no recording at all -> 0 points, not pending
        MvcResult result = submit(student, attemptId, sheet);
        String json = result.getResponse().getContentAsString();
        assertThat((List<Double>) JsonPath.read(json, "$.answers[*].pointsAwarded"))
                .containsExactly(2.0, 2.0, 4.0, 3.0, 3.0, 0.0);
        assertThat((String) JsonPath.read(json, "$.status")).isEqualTo("GRADED");
        assertThat((Double) JsonPath.read(json, "$.score")).isEqualTo(14.0);
    }

    @Test
    void speakingIsGradedManuallyAndFeedbackReachesTheLearner() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        String recording = upload(student, "aufnahme.webm", "audio/webm", WEBM);
        submit(student, attemptId, perfectSheet(session, recording));

        MvcResult instructorView = mvc.perform(auth(get("/api/instructor/attempts/" + attemptId), quiz.teacher()))
                .andExpect(status().isOk()).andReturn();
        String json = instructorView.getResponse().getContentAsString();
        assertThat((String) JsonPath.read(json, "$.answers[5].responseMedia.url")).startsWith("http");
        assertThat((Object) JsonPath.read(json, "$.answers[5].pointsAwarded")).isNull();
        String speakingQ = JsonPath.read(json, "$.answers[5].questionId");

        // more than the question's points is refused
        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + attemptId + "/grade"), Map.of("grades",
                List.of(Map.of("questionId", speakingQ, "pointsAwarded", 6.0)))), quiz.teacher()))
                .andExpect(status().isBadRequest());

        mvc.perform(auth(jsonBody(post("/api/instructor/attempts/" + attemptId + "/grade"), Map.of("grades",
                List.of(Map.of("questionId", speakingQ, "pointsAwarded", 4.5, "feedback", "Gut verständlich!")))),
                        quiz.teacher()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRADED"))
                .andExpect(jsonPath("$.score").value(22.5));

        mvc.perform(auth(get("/api/student/attempts/" + attemptId), student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers[5].feedback").value("Gut verständlich!"))
                .andExpect(jsonPath("$.answers[5].responseMedia.url").exists())
                .andExpect(jsonPath("$.answers[5].pointsAwarded").value(4.5));
    }

    @Test
    void speakingWithSomeoneElsesOrNonAudioMediaIsRejected() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        String other = signUp(uniqueEmail("lang-other"), "STUDENT");
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        String speakingQ = questionId(session, "SPEAKING");

        String foreign = upload(other, "fremd.webm", "audio/webm", WEBM);
        String notAudio = upload(student, "bild.png", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3});
        for (String bad : List.of(foreign, notAudio, UUID.randomUUID().toString(), quiz.audioId())) {
            Map<String, Object> a = answer(speakingQ);
            a.put("responseMediaId", bad);
            mvc.perform(auth(jsonBody(put("/api/student/attempts/" + attemptId + "/answers"), Map.of("answers", List.of(a))),
                            student))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors['answers[0].responseMediaId']").exists());
            mvc.perform(auth(jsonBody(post("/api/student/attempts/" + attemptId + "/submit"), Map.of("answers", List.of(a))),
                            student))
                    .andExpect(status().isBadRequest());
        }
        // nothing was stored and the attempt is still open
        mvc.perform(auth(post("/api/student/items/" + quiz.itemId() + "/attempts"), student))
                .andExpect(jsonPath("$.id").value(attemptId))
                .andExpect(jsonPath("$.savedAnswers.length()").value(0));
    }

    @Test
    void answersAreGradedAgainstTheSnapshotAfterTheQuizIsEdited() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        List<Map<String, Object>> sheet = perfectSheet(session, upload(student, "a.webm", "audio/webm", WEBM));

        // the instructor rewrites the quiz while the attempt is running: other answers, other chips, fewer questions
        Map<String, Object> cloze = clozeQuestion(quiz.audioId());
        cloze.put("blanks", List.of(blank(1, "ganz anders"), blank(2, "auch anders")));
        Map<String, Object> bank = wordBankQuestion();
        bank.put("options", List.of(opt("fährt", true, null, 2), opt("lernt", true, null, 1), opt("x", false, null, null)));
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz.itemId() + "/assessment"),
                        Map.of("questions", List.of(cloze, bank))), quiz.teacher()))
                .andExpect(status().isOk());

        MvcResult result = submit(student, attemptId, sheet);
        String json = result.getResponse().getContentAsString();
        assertThat((List<Boolean>) JsonPath.read(json, "$.answers[*].correct")).containsExactly(true, true, true, true, true, null);
        assertThat((Double) JsonPath.read(json, "$.score")).isEqualTo(18.0);

        // a new attempt uses the new definition
        MvcResult next = mvc.perform(auth(post("/api/student/items/" + quiz.itemId() + "/attempts"), student))
                .andExpect(status().isOk()).andReturn();
        assertThat((Integer) JsonPath.read(next.getResponse().getContentAsString(), "$.questions.length()")).isEqualTo(2);
    }

    @Test
    void expiredAttemptIsAutoSubmittedWithTheAutosavedLanguageAnswers() throws Exception {
        Quiz quiz = quiz(true, 30);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        List<Map<String, Object>> sheet = perfectSheet(session, upload(student, "a.webm", "audio/webm", WEBM));
        // only some questions were saved before time ran out
        autosave(student, attemptId, List.of(sheet.get(0), sheet.get(2), sheet.get(3)));

        Instant deadline = Instant.now().minus(Duration.ofMinutes(2)).truncatedTo(ChronoUnit.MILLIS);
        jdbc.update("update attempts set started_at = ?, deadline = ? where id = ?",
                java.sql.Timestamp.from(deadline.minus(Duration.ofMinutes(28))), java.sql.Timestamp.from(deadline),
                UUID.fromString(attemptId));

        // a late submit with the full sheet is ignored: the saved answers are graded
        MvcResult result = submit(student, attemptId, sheet);
        String json = result.getResponse().getContentAsString();
        assertThat((Boolean) JsonPath.read(json, "$.autoSubmitted")).isTrue();
        assertThat((List<Double>) JsonPath.read(json, "$.answers[*].pointsAwarded"))
                .containsExactly(4.0, 0.0, 4.0, 4.0, 0.0, 0.0);
        assertThat((String) JsonPath.read(json, "$.status")).isEqualTo("GRADED");
    }

    @Test
    void correctAnswersStayHiddenWhenTheQuizDoesNotShowThem() throws Exception {
        Quiz quiz = quiz(false, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        List<Map<String, Object>> sheet = new ArrayList<>(perfectSheet(session, upload(student, "a.webm", "audio/webm", WEBM)));
        Map<String, Object> cloze = answer(questionId(session, "CLOZE"));
        cloze.put("blanks", Map.of("1", "nope"));
        sheet.set(0, cloze);
        String json = submit(student, attemptId, sheet).getResponse().getContentAsString();
        // per-blank correctness is part of the result, the solutions are not
        assertThat((List<Boolean>) JsonPath.read(json, "$.answers[0].blankResults[*].correct")).containsExactly(false, false);
        assertThat(json).doesNotContain("bin gewesen").doesNotContain("trinkt gern Tee").doesNotContain("\"correctOrder\":[\"")
                .doesNotContain("\"expectedRight\":\"");
        assertThat((Object) JsonPath.read(json, "$.answers[0].blankResults[0].expected")).isNull();
        assertThat((Object) JsonPath.read(json, "$.answers[3].correctOrder")).isNull();
        assertThat((Object) JsonPath.read(json, "$.answers[4].acceptedAnswers")).isNull();
        assertThat((Object) JsonPath.read(json, "$.answers[1].options[0].blankIndex")).isNull();
        assertThat((Object) JsonPath.read(json, "$.answers[2].options[0].matchText")).isNull();
    }

    @Test
    void reportAnalyticsCountsPartialAndUnansweredLanguageAnswers() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        // CLOZE half right (partial credit), ORDERING answered correctly, everything else left blank
        Map<String, Object> cloze = answer(questionId(session, "CLOZE"));
        cloze.put("blanks", Map.of("1", "war", "2", "falsch"));
        List<Map<String, Object>> items = options(session, "ORDERING");
        Map<String, Object> ordering = answer(questionId(session, "ORDERING"));
        ordering.put("order", List.of(optionId(items, "Morgen"), optionId(items, "fahre"), optionId(items, "ich"),
                optionId(items, "nach Hamburg")));
        submit(student, attemptId, List.of(cloze, ordering));

        MvcResult report = mvc.perform(auth(get("/api/instructor/items/" + quiz.itemId() + "/reports/assessment"),
                quiz.teacher())).andExpect(status().isOk()).andReturn();
        String json = report.getResponse().getContentAsString();
        assertThat(JsonPath.<List<String>>read(json, "$.questions[*].type"))
                .containsExactly("CLOZE", "WORD_BANK", "MATCHING", "ORDERING", "DICTATION", "SPEAKING");
        // cloze: answered, not fully correct, average 2 of 4 points
        assertThat(JsonPath.<Integer>read(json, "$.questions[0].answered")).isEqualTo(1);
        assertThat(((Number) JsonPath.read(json, "$.questions[0].percentCorrect")).doubleValue()).isEqualTo(0.0);
        assertThat(((Number) JsonPath.read(json, "$.questions[0].averagePoints")).doubleValue()).isEqualTo(2.0);
        assertThat(((Number) JsonPath.read(json, "$.questions[3].percentCorrect")).doubleValue()).isEqualTo(100.0);
        // unanswered language questions are counted as such (and speaking is still waiting for the instructor)
        assertThat(JsonPath.<Integer>read(json, "$.questions[1].unanswered")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(json, "$.questions[2].unanswered")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(json, "$.questions[4].unanswered")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(json, "$.questions[5].unanswered")).isEqualTo(1);
        // CSV export keeps working with the new types
        mvc.perform(auth(get("/api/instructor/items/" + quiz.itemId() + "/reports/attempts.csv"), quiz.teacher()))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ robustness

    @Test
    void badLanguageAnswerPayloadsNeverCauseServerErrors() throws Exception {
        Quiz quiz = quiz(true, null);
        String student = student(quiz);
        MvcResult session = start(quiz, student);
        String attemptId = read(session, "$.id");
        String cloze = questionId(session, "CLOZE");
        String bank = questionId(session, "WORD_BANK");
        String matching = questionId(session, "MATCHING");
        String ordering = questionId(session, "ORDERING");

        Map<String, String> manyBlanks = new HashMap<>();
        for (int i = 0; i < 80; i++) {
            manyBlanks.put(String.valueOf(i), "x");
        }
        List<Object> payloads = new ArrayList<>();
        payloads.add(Map.of("questionId", cloze, "blanks", Map.of("1", "x".repeat(600))));
        payloads.add(Map.of("questionId", cloze, "blanks", manyBlanks));
        payloads.add(Map.of("questionId", cloze, "blanks", Map.of("", "x")));
        payloads.add(Map.of("questionId", cloze, "blanks", Map.of("-1", "x", "abc", "y")));
        payloads.add(Map.of("questionId", bank, "blanks", Map.of("1", "not-a-uuid", "2", UUID.randomUUID().toString())));
        payloads.add(Map.of("questionId", matching, "pairs", Map.of("a", "b", UUID.randomUUID().toString(), "c")));
        payloads.add(Map.of("questionId", ordering, "order", List.of("zzz", UUID.randomUUID().toString())));
        payloads.add(Map.of("questionId", ordering, "order", java.util.Collections.nCopies(80, "x")));
        payloads.add(Map.of("questionId", ordering, "responseMediaId", "not-a-uuid"));
        payloads.add(Map.of("questionId", UUID.randomUUID().toString(), "order", List.of("x")));
        for (Object payload : payloads) {
            for (String path : List.of("answers", "submit")) {
                MvcResult r = mvc.perform(auth(jsonBody(path.equals("answers") ? put("/api/student/attempts/" + attemptId + "/answers")
                                : post("/api/student/attempts/" + attemptId + "/submit"), Map.of("answers", List.of(payload))), student))
                        .andReturn();
                assertThat(r.getResponse().getStatus()).as("%s %s", path, payload).isLessThan(500);
                if (path.equals("submit") && r.getResponse().getStatus() == 200) {
                    return; // the attempt is closed now, further payloads would only see 409
                }
            }
        }
    }

    @Test
    void languageTypesWithGarbageDefinitionsAreRejectedNotCrashing() throws Exception {
        Quiz quiz = quiz(true, null);
        List<Map<String, Object>> bad = new ArrayList<>();
        Map<String, Object> hugeIndex = clozeQuestion(null);
        hugeIndex.put("prompt", "{{999}} und {{0}}");
        bad.add(hugeIndex);
        Map<String, Object> nullBlanks = clozeQuestion(null);
        nullBlanks.put("blanks", null);
        bad.add(nullBlanks);
        Map<String, Object> badIndex = clozeQuestion(null);
        badIndex.put("blanks", List.of(Map.of("index", 0, "acceptedAnswers", List.of("x"))));
        bad.add(badIndex);
        Map<String, Object> chipBlank = wordBankQuestion();
        chipBlank.put("options", List.of(opt("a", true, null, 500), opt("b", false, null, null)));
        bad.add(chipBlank);
        Map<String, Object> hugeRecording = speakingQuestion();
        hugeRecording.put("maxRecordingSeconds", 999999);
        bad.add(hugeRecording);
        Map<String, Object> unknownMedia = dictationQuestion(UUID.randomUUID().toString());
        bad.add(unknownMedia);
        for (Map<String, Object> q : bad) {
            MvcResult r = mvc.perform(auth(jsonBody(put("/api/instructor/items/" + quiz.itemId() + "/assessment"),
                            Map.of("questions", List.of(q))), quiz.teacher())).andReturn();
            assertThat(r.getResponse().getStatus()).as("%s", q).isEqualTo(400);
        }
    }
}
