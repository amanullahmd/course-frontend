package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

/** Decks, CSV import/export, the review queue, SM-2 grading and the permission rules around them. */
class FlashcardIT extends PracticeTestSupport {

    @Autowired
    JdbcTemplate jdbc;

    private static Map<String, Object> card(String front, String back, String article) {
        Map<String, Object> m = new HashMap<>();
        m.put("front", front);
        m.put("back", back);
        m.put("article", article);
        return m;
    }

    private static Map<String, Object> deck(List<Map<String, Object>> cards) {
        return Map.of("cards", cards);
    }

    private org.springframework.test.web.servlet.ResultActions saveDeck(String teacher, String itemId,
                                                                        List<Map<String, Object>> cards) throws Exception {
        return mvc.perform(auth(jsonBody(put("/api/instructor/items/" + itemId + "/flashcards"), deck(cards)), teacher));
    }

    private MvcResult importCsv(String teacher, String itemId, String csv, boolean commit) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "vokabeln.csv", "text/csv",
                csv.getBytes(StandardCharsets.UTF_8));
        return mvc.perform(multipart("/api/instructor/items/" + itemId + "/flashcards/import")
                .file(file).param("commit", String.valueOf(commit)).header("Authorization", "Bearer " + teacher))
                .andReturn();
    }

    @Test
    void instructorEditsDeckWithReplaceSemanticsAndOwnership() throws Exception {
        Setup s = course();
        String deck = item(s, "FLASHCARDS", "Vokabeln");
        String text = item(s, "TEXT", "Lektion");
        String other = signUp(uniqueEmail("fc-other"), "INSTRUCTOR");
        String student = learner(s, "fc-stud");
        String url = "/api/instructor/items/" + deck + "/flashcards";

        mvc.perform(auth(get(url), s.teacher())).andExpect(status().isOk())
                .andExpect(jsonPath("$.itemId").value(deck)).andExpect(jsonPath("$.cards.length()").value(0));

        MvcResult saved = saveDeck(s.teacher(), deck, List.of(card("Tisch", "table", "Der"), card("Lampe", "lamp", "die"),
                card("gehen", "to go", ""))).andExpect(status().isOk()).andExpect(jsonPath("$.cards.length()").value(3))
                .andExpect(jsonPath("$.cards[0].article").value("der"))
                .andExpect(jsonPath("$.cards[2].article").doesNotExist())
                .andExpect(jsonPath("$.cards[1].position").value(1)).andReturn();
        String lampId = read(saved, "$.cards[1].id");
        String tableId = read(saved, "$.cards[0].id");

        // update one by id, drop one, add one, reorder: lamp first
        Map<String, Object> lamp = card("Lampe (neu)", "light", "die");
        lamp.put("id", lampId);
        lamp.put("plural", "Lampen");
        lamp.put("example", "Die Lampe ist an.");
        saveDeck(s.teacher(), deck, List.of(lamp, card("Buch", "book", "das")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cards.length()").value(2))
                .andExpect(jsonPath("$.cards[0].id").value(lampId))
                .andExpect(jsonPath("$.cards[0].front").value("Lampe (neu)"))
                .andExpect(jsonPath("$.cards[0].plural").value("Lampen"))
                .andExpect(jsonPath("$.cards[1].front").value("Buch"));

        // validation and permissions
        Map<String, Object> gone = card("x", "y", null);
        gone.put("id", tableId);
        saveDeck(s.teacher(), deck, List.of(gone)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        saveDeck(s.teacher(), deck, List.of(card("x", "y", "ein"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['cards[0].article']").exists());
        saveDeck(s.teacher(), deck, List.of(card(" ", "y", null))).andExpect(status().isBadRequest());
        saveDeck(s.teacher(), deck, List.of(card("x".repeat(501), "y", null))).andExpect(status().isBadRequest());
        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int i = 0; i < 2001; i++) {
            tooMany.add(card("w" + i, "b", null));
        }
        saveDeck(s.teacher(), deck, tooMany).andExpect(status().isBadRequest());
        saveDeck(other, deck, List.of(card("x", "y", null))).andExpect(status().isNotFound());
        mvc.perform(auth(get(url), other)).andExpect(status().isNotFound());
        saveDeck(student, deck, List.of(card("x", "y", null))).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/instructor/items/" + text + "/flashcards"), s.teacher()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("FLASHCARDS_NOT_FOUND"));
        mvc.perform(auth(get("/api/instructor/items/" + UUID.randomUUID() + "/flashcards"), s.teacher()))
                .andExpect(status().isNotFound());
        // media must be an audio/image file of the caller
        Map<String, Object> withMedia = card("a", "b", null);
        withMedia.put("audioMediaId", UUID.randomUUID().toString());
        saveDeck(s.teacher(), deck, List.of(withMedia)).andExpect(status().isBadRequest());
        String textFile = upload(s.teacher(), "notes.txt", "hello");
        withMedia.put("audioMediaId", textFile);
        saveDeck(s.teacher(), deck, List.of(withMedia)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['cards[0].audioMediaId']").exists());
    }

    @Test
    void csvImportPreviewCommitErrorsAndExport() throws Exception {
        Setup s = course();
        String deck = item(s, "FLASHCARDS", "CSV-Deck");
        String csv = "front;back;article;plural;example\n"
                + "Tisch;table;der;Tische;Der Tisch ist groß.\n"
                + ";broken;die\n"
                + "Buch;book;das;Bücher\n"
                + "Haus;house;ein\n";

        MvcResult preview = importCsv(s.teacher(), deck, csv, false);
        assertThat(preview.getResponse().getStatus()).isEqualTo(200);
        assertThat((Boolean) read(preview, "$.committed")).isFalse();
        assertThat((Integer) read(preview, "$.cards.length()")).isEqualTo(2);
        assertThat((Integer) read(preview, "$.errors.length()")).isEqualTo(2);
        assertThat((Integer) read(preview, "$.errors[0].line")).isEqualTo(3);
        assertThat((String) read(preview, "$.errors[1].code")).isEqualTo("ARTICLE_INVALID");
        mvc.perform(auth(get("/api/instructor/items/" + deck + "/flashcards"), s.teacher()))
                .andExpect(jsonPath("$.cards.length()").value(0));

        MvcResult done = importCsv(s.teacher(), deck, csv, true);
        assertThat((Boolean) read(done, "$.committed")).isTrue();
        assertThat((Integer) read(done, "$.imported")).isEqualTo(2);
        assertThat((Integer) read(done, "$.totalCards")).isEqualTo(2);
        // a second import appends
        importCsv(s.teacher(), deck, "Katze;cat;die;Katzen\n", true);
        mvc.perform(auth(get("/api/instructor/items/" + deck + "/flashcards"), s.teacher()))
                .andExpect(jsonPath("$.cards.length()").value(3)).andExpect(jsonPath("$.cards[2].front").value("Katze"))
                .andExpect(jsonPath("$.cards[2].position").value(2));

        MvcResult export = mvc.perform(auth(get("/api/instructor/items/" + deck + "/flashcards/export"), s.teacher()))
                .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("CSV-Deck.csv")))
                .andExpect(content().contentTypeCompatibleWith("text/csv")).andReturn();
        String body = new String(export.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(body).contains("front;back;article;plural;example").contains("Tisch;table;der;Tische;Der Tisch ist groß.")
                .contains("Katze;cat;die;Katzen;");

        // bad input
        MvcResult empty = mvc.perform(multipart("/api/instructor/items/" + deck + "/flashcards/import")
                .file(new MockMultipartFile("file", "x.csv", "text/csv", new byte[0]))
                .header("Authorization", "Bearer " + s.teacher())).andReturn();
        assertThat(empty.getResponse().getStatus()).isEqualTo(400);
        mvc.perform(multipart("/api/instructor/items/" + deck + "/flashcards/import")
                .header("Authorization", "Bearer " + s.teacher())).andExpect(status().isBadRequest());
        MvcResult binary = importCsv(s.teacher(), deck, "\0\0\u0001;;;\n\"unterminated", false);
        assertThat(binary.getResponse().getStatus()).isEqualTo(200);
        String student = learner(s, "fc-csv-stud");
        assertThat(importCsv(student, deck, csv, true).getResponse().getStatus()).isEqualTo(403);
        String other = signUp(uniqueEmail("fc-csv-other"), "INSTRUCTOR");
        assertThat(importCsv(other, deck, csv, true).getResponse().getStatus()).isEqualTo(404);
        mvc.perform(auth(get("/api/instructor/items/" + deck + "/flashcards/export"), other))
                .andExpect(status().isNotFound());
    }

    @Test
    void reviewQueueGradingAndPerLearnerIsolation() throws Exception {
        Setup s = course();
        String deck = item(s, "FLASHCARDS", "Review-Deck");
        List<Map<String, Object>> cards = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            cards.add(card("Wort " + i, "word " + i, i % 3 == 0 ? "der" : null));
        }
        saveDeck(s.teacher(), deck, cards).andExpect(status().isOk());
        String anna = learner(s, "fc-anna");
        String ben = learner(s, "fc-ben");
        String outsider = signUp(uniqueEmail("fc-out"), "STUDENT");
        String review = "/api/student/courses/" + s.courseId() + "/review";

        // 15 new cards per day, fewer with a smaller limit
        MvcResult session = mvc.perform(auth(get(review), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.newCount").value(15)).andExpect(jsonPath("$.dueCount").value(0))
                .andExpect(jsonPath("$.newPerDay").value(15)).andExpect(jsonPath("$.cards.length()").value(15))
                .andExpect(jsonPath("$.cards[0].front").value("Wort 0")).andExpect(jsonPath("$.cards[0].newCard").value(true))
                .andExpect(jsonPath("$.cards[0].deckTitle").value("Review-Deck")).andReturn();
        mvc.perform(auth(get(review + "?limit=3"), anna)).andExpect(jsonPath("$.cards.length()").value(3));
        mvc.perform(auth(get(review + "?limit=-5"), anna)).andExpect(status().isOk());
        mvc.perform(auth(get(review + "?limit=abc"), anna)).andExpect(status().isBadRequest());
        String c0 = read(session, "$.cards[0].id");
        String c1 = read(session, "$.cards[1].id");
        String c2 = read(session, "$.cards[2].id");

        mvc.perform(auth(get("/api/student/review/summary"), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.dueToday").value(15)).andExpect(jsonPath("$.byCourse[0].newCards").value(15))
                .andExpect(jsonPath("$.byCourse[0].courseId").value(s.courseId()));

        // grading: GOOD -> 1 day, AGAIN -> 10 minutes (not due yet), EASY -> 3 days
        MvcResult good = mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c0 + "/review"),
                        Map.of("grade", "GOOD")), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.intervalDays").value(1)).andExpect(jsonPath("$.repetitions").value(1))
                .andExpect(jsonPath("$.ease").value(2.5)).andReturn();
        Instant due = Instant.parse(read(good, "$.dueAt"));
        assertThat(due).isBetween(Instant.now().plus(Duration.ofHours(23)), Instant.now().plus(Duration.ofHours(25)));
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c1 + "/review"), Map.of("grade", "AGAIN")), anna))
                .andExpect(jsonPath("$.lapses").value(1)).andExpect(jsonPath("$.repetitions").value(0))
                .andExpect(jsonPath("$.ease").value(2.3));
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c2 + "/review"), Map.of("grade", "EASY")), anna))
                .andExpect(jsonPath("$.intervalDays").value(3));

        // reviewed cards are no longer new: 20 - 3 = 17 unseen, but today's quota (15) is used up by 3 -> 12 left
        mvc.perform(auth(get(review + "?limit=100"), anna)).andExpect(jsonPath("$.newCount").value(12))
                .andExpect(jsonPath("$.dueCount").value(0)).andExpect(jsonPath("$.cards.length()").value(12));
        // make two reviews due: they come first and are not new
        jdbc.update("update flashcard_reviews set due_at = ? where card_id in (?, ?)",
                java.sql.Timestamp.from(Instant.now().minus(Duration.ofHours(1))), UUID.fromString(c0), UUID.fromString(c1));
        mvc.perform(auth(get(review + "?limit=5"), anna)).andExpect(jsonPath("$.dueCount").value(2))
                .andExpect(jsonPath("$.cards.length()").value(5))
                .andExpect(jsonPath("$.cards[0].newCard").value(false)).andExpect(jsonPath("$.cards[1].newCard").value(false))
                .andExpect(jsonPath("$.cards[2].newCard").value(true));
        mvc.perform(auth(get("/api/student/review/summary"), anna)).andExpect(jsonPath("$.dueToday").value(14))
                .andExpect(jsonPath("$.byCourse[0].due").value(2));

        // other learners are not affected
        mvc.perform(auth(get(review), ben)).andExpect(jsonPath("$.dueCount").value(0))
                .andExpect(jsonPath("$.newCount").value(15)).andExpect(jsonPath("$.cards[0].id").value(c0))
                .andExpect(jsonPath("$.cards[0].newCard").value(true));
        // browse mode shows own state
        mvc.perform(auth(get("/api/student/items/" + deck + "/flashcards"), anna)).andExpect(status().isOk())
                .andExpect(jsonPath("$.cards.length()").value(20)).andExpect(jsonPath("$.dueCount").value(2))
                .andExpect(jsonPath("$.cards[0].reviewed").value(true)).andExpect(jsonPath("$.cards[5].reviewed").value(false));
        mvc.perform(auth(get("/api/student/items/" + deck + "/flashcards"), ben))
                .andExpect(jsonPath("$.cards[0].reviewed").value(false)).andExpect(jsonPath("$.newCount").value(20));

        // not enrolled: no queue, no grading, no deck, nothing in the summary
        mvc.perform(auth(get(review), outsider)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c0 + "/review"), Map.of("grade", "GOOD")), outsider))
                .andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/student/items/" + deck + "/flashcards"), outsider)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/student/review/summary"), outsider)).andExpect(jsonPath("$.dueToday").value(0))
                .andExpect(jsonPath("$.byCourse.length()").value(0));

        // bad input
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c0 + "/review"), Map.of("grade", "PERFECT")), anna))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + c0 + "/review"), Map.of()), anna))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post("/api/student/flashcards/" + UUID.randomUUID() + "/review"),
                Map.of("grade", "GOOD")), anna)).andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/student/flashcards/not-a-uuid/review"), anna)).andExpect(status().isBadRequest());
        mvc.perform(get(review)).andExpect(status().isUnauthorized());
    }

    @Test
    void hiddenDecksAreNotPartOfTheQueue() throws Exception {
        Setup s = course();
        String visible = item(s, "FLASHCARDS", "Sichtbar");
        String hidden = item(s, "FLASHCARDS", "Versteckt");
        saveDeck(s.teacher(), visible, List.of(card("eins", "one", null))).andExpect(status().isOk());
        saveDeck(s.teacher(), hidden, List.of(card("zwei", "two", null))).andExpect(status().isOk());
        String student = learner(s, "fc-hidden");
        mvc.perform(auth(get("/api/student/courses/" + s.courseId() + "/review"), student))
                .andExpect(jsonPath("$.cards.length()").value(2));
        Map<String, Object> draft = new HashMap<>();
        draft.put("publishStatus", "DRAFT");
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + hidden + "/publication"), draft), s.teacher()))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/student/courses/" + s.courseId() + "/review"), student))
                .andExpect(jsonPath("$.cards.length()").value(1)).andExpect(jsonPath("$.cards[0].front").value("eins"));
        mvc.perform(auth(get("/api/student/items/" + hidden + "/flashcards"), student)).andExpect(status().isNotFound());
    }
}
