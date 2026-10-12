package me.amanullah.course.flashcard;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class FlashcardCsvTest {

    @Test
    void parsesSemicolonFilesWithHeaderBomAndQuotes() {
        String csv = "﻿front;back;article;plural;example\r\n"
                + "Tisch;table;der;Tische;\"Der Tisch; gross, \"\"alt\"\"\"\r\n"
                + "\r\n"
                + "gehen;to go;;;\r\n"
                + "Mädchen;girl;DAS;Mädchen\r\n";
        FlashcardCsv.Result r = FlashcardCsv.parse(csv);
        assertThat(r.errors()).isEmpty();
        assertThat(r.rows()).isEqualTo(3);
        assertThat(r.cards()).containsExactly(
                new FlashcardCsv.Card("Tisch", "table", "der", "Tische", "Der Tisch; gross, \"alt\""),
                new FlashcardCsv.Card("gehen", "to go", null, null, null),
                new FlashcardCsv.Card("Mädchen", "girl", "das", "Mädchen", null));
    }

    @Test
    void parsesTabSeparatedFilesWithoutHeader() {
        FlashcardCsv.Result r = FlashcardCsv.parse("Haus\thouse\tdas\tHäuser\nKatze\tcat\tdie\tKatzen\tIch mag Katzen.");
        assertThat(r.errors()).isEmpty();
        assertThat(r.cards()).hasSize(2);
        assertThat(r.cards().get(1).example()).isEqualTo("Ich mag Katzen.");
    }

    @Test
    void quotedFieldsMaySpanLines() {
        FlashcardCsv.Result r = FlashcardCsv.parse("a;\"line one\nline two\";\nb;c;\n");
        assertThat(r.cards()).hasSize(2);
        assertThat(r.cards().get(0).back()).isEqualTo("line one\nline two");
        assertThat(r.cards().get(1).front()).isEqualTo("b");
    }

    @Test
    void reportsRowErrorsWithLineNumbersAndKeepsValidRows() {
        String csv = "front;back;article\n"
                + "Tisch;table;der\n"       // line 2 ok
                + ";missing front;die\n"    // line 3
                + "Lampe;;die\n"            // line 4
                + "Buch;book;ein\n"         // line 5
                + "x".repeat(501) + ";long;\n"; // line 6
        FlashcardCsv.Result r = FlashcardCsv.parse(csv);
        assertThat(r.cards()).extracting(FlashcardCsv.Card::front).containsExactly("Tisch");
        assertThat(r.errors()).extracting(FlashcardCsv.RowError::line, FlashcardCsv.RowError::field,
                        FlashcardCsv.RowError::code)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(3, "front", "REQUIRED"),
                        org.assertj.core.groups.Tuple.tuple(4, "back", "REQUIRED"),
                        org.assertj.core.groups.Tuple.tuple(5, "article", "ARTICLE_INVALID"),
                        org.assertj.core.groups.Tuple.tuple(6, "front", "TOO_LONG"));
    }

    @Test
    void emptyAndGarbageInputNeverThrows() {
        assertThat(FlashcardCsv.parse(null).cards()).isEmpty();
        assertThat(FlashcardCsv.parse("").cards()).isEmpty();
        assertThat(FlashcardCsv.parse("\n\n;;;\n").cards()).isEmpty();
        assertThat(FlashcardCsv.parse("\"unterminated;quote\nstill;going").errors()).isNotNull();
        assertThat(FlashcardCsv.parse("\0\0\0;\u0001").rows()).isEqualTo(1);
    }

    @Test
    void exportRoundTrips() {
        List<FlashcardCsv.Card> cards = List.of(
                new FlashcardCsv.Card("Tisch", "table; desk", "der", "Tische", "Er sagt: \"Hallo\""),
                new FlashcardCsv.Card("=SUM(A1)", "formula", null, null, null),
                new FlashcardCsv.Card("Wasser", "water", "das", null, "Zeile 1\nZeile 2"));
        byte[] bytes = FlashcardCsv.export(cards);
        assertThat(bytes[0]).isEqualTo((byte) 0xEF);
        String text = new String(bytes, StandardCharsets.UTF_8);
        assertThat(text).contains("'=SUM(A1)");
        FlashcardCsv.Result back = FlashcardCsv.parse(text);
        assertThat(back.errors()).isEmpty();
        assertThat(back.cards()).isEqualTo(cards);
    }
}
