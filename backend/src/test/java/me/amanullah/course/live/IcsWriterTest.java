package me.amanullah.course.live;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class IcsWriterTest {

    private static final Instant START = Instant.parse("2026-10-27T17:00:00Z");

    /** Unfolds the content lines (RFC 5545 section 3.1). */
    static List<String> unfold(String ics) {
        assertThat(ics).endsWith("\r\n");
        assertThat(ics).doesNotContain("\n\n").doesNotContain("\r\r");
        String[] raw = ics.split("\r\n", -1);
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < raw.length - 1; i++) {
            if (raw[i].startsWith(" ") && !lines.isEmpty()) {
                lines.set(lines.size() - 1, lines.get(lines.size() - 1) + raw[i].substring(1));
            } else {
                lines.add(raw[i]);
            }
        }
        return lines;
    }

    @Test
    void escapesTextAsRfc5545() {
        assertThat(IcsWriter.escape("a,b;c\\d\ne\r\nf\rg")).isEqualTo("a\\,b\\;c\\\\d\\ne\\nf\\ng");
        assertThat(IcsWriter.escape(null)).isEmpty();
        assertThat(IcsWriter.escape("tab\tok\u0001gone")).isEqualTo("tab\tokgone");
    }

    @Test
    void writesAValidCalendarWithCrlfAndUtcTimes() {
        String ics = IcsWriter.calendar("Sprachweg", List.of(
                new IcsWriter.Event("session-1@sprachweg", START, START.plusSeconds(3600),
                        "[Deutsch A1] Sprechstunde, Teil 1; Übung", "Zeile 1\nZeile 2, mit Komma",
                        "https://example.org/learn/1", false, Instant.parse("2026-10-01T10:00:00Z")),
                new IcsWriter.Event("session-2@sprachweg", START.plusSeconds(86400), START.plusSeconds(90000),
                        "Abgesagt", null, null, true, Instant.parse("2026-10-01T10:00:00Z"))));
        List<String> lines = unfold(ics);
        assertThat(lines.get(0)).isEqualTo("BEGIN:VCALENDAR");
        assertThat(lines).contains("VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH");
        assertThat(lines.get(lines.size() - 1)).isEqualTo("END:VCALENDAR");
        assertThat(lines.stream().filter("BEGIN:VEVENT"::equals).count()).isEqualTo(2);
        assertThat(lines.stream().filter("END:VEVENT"::equals).count()).isEqualTo(2);
        assertThat(lines).contains("UID:session-1@sprachweg", "DTSTART:20261027T170000Z", "DTEND:20261027T180000Z",
                "DTSTAMP:20261001T100000Z",
                "SUMMARY:[Deutsch A1] Sprechstunde\\, Teil 1\\; Übung",
                "DESCRIPTION:Zeile 1\\nZeile 2\\, mit Komma", "URL:https://example.org/learn/1",
                "STATUS:CONFIRMED", "STATUS:CANCELLED");
        // every event has the mandatory properties
        for (String prop : List.of("UID:", "DTSTAMP:", "DTSTART:", "DTEND:", "SUMMARY:")) {
            assertThat(lines.stream().filter(l -> l.startsWith(prop)).count()).as(prop).isEqualTo(2);
        }
    }

    @Test
    void foldsLongLinesAtSeventyFiveOctetsWithoutSplittingCharacters() {
        String summary = "Übung für Fortgeschrittene ".repeat(12) + "😀".repeat(20);
        String ics = IcsWriter.calendar("x", List.of(new IcsWriter.Event("u@x", START, START.plusSeconds(60), summary,
                null, null, false, START)));
        for (String physical : ics.split("\r\n")) {
            assertThat(physical.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75);
        }
        assertThat(unfold(ics)).contains("SUMMARY:" + IcsWriter.escape(summary));
    }

    @Test
    void headerInjectionIsImpossible() {
        String ics = IcsWriter.calendar("x\r\nEND:VCALENDAR", List.of(new IcsWriter.Event("u\r\nX:1@x", START,
                START.plusSeconds(60), "Title\r\nBEGIN:VEVENT", null, "https://e.org/\r\nX-EVIL:1", false, START)));
        List<String> lines = unfold(ics);
        assertThat(lines.stream().filter("END:VCALENDAR"::equals).count()).isEqualTo(1);
        assertThat(lines.stream().filter("BEGIN:VEVENT"::equals).count()).isEqualTo(1);
        assertThat(lines).noneMatch(l -> l.startsWith("X-EVIL"));
    }
}
