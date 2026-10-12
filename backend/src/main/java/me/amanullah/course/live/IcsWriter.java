package me.amanullah.course.live;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Minimal RFC 5545 writer: CRLF line endings, UTC date-times, TEXT escaping ({@code \ ; ,} and line breaks) and
 * line folding at 75 octets (never inside a multi-byte character). Pure, unit tested.
 */
public final class IcsWriter {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
            .withZone(ZoneOffset.UTC);

    private IcsWriter() {
    }

    /** {@code url} is optional; {@code description} may contain line breaks. */
    public record Event(String uid, Instant start, Instant end, String summary, String description, String url,
                        boolean cancelled, Instant stamp) {
    }

    public static String calendar(String name, List<Event> events) {
        StringBuilder out = new StringBuilder();
        line(out, "BEGIN:VCALENDAR");
        line(out, "VERSION:2.0");
        line(out, "PRODID:-//Sprachweg//Course calendar//EN");
        line(out, "CALSCALE:GREGORIAN");
        line(out, "METHOD:PUBLISH");
        line(out, "X-WR-CALNAME:" + escape(name));
        line(out, "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
        line(out, "X-PUBLISHED-TTL:PT1H");
        for (Event e : events) {
            line(out, "BEGIN:VEVENT");
            line(out, "UID:" + oneLine(e.uid()));
            line(out, "DTSTAMP:" + UTC.format(e.stamp()));
            line(out, "DTSTART:" + UTC.format(e.start()));
            line(out, "DTEND:" + UTC.format(e.end()));
            line(out, "SUMMARY:" + escape(e.summary()));
            if (e.description() != null && !e.description().isBlank()) {
                line(out, "DESCRIPTION:" + escape(e.description()));
            }
            if (e.url() != null && !e.url().isBlank()) {
                line(out, "URL:" + oneLine(e.url()));
            }
            line(out, "STATUS:" + (e.cancelled() ? "CANCELLED" : "CONFIRMED"));
            line(out, "TRANSP:" + (e.cancelled() ? "TRANSPARENT" : "OPAQUE"));
            line(out, "END:VEVENT");
        }
        line(out, "END:VCALENDAR");
        return out.toString();
    }

    /** TEXT value escaping of RFC 5545 section 3.3.11. */
    public static String escape(String text) {
        if (text == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(text.length() + 8);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '\\' -> sb.append("\\\\");
                case ';' -> sb.append("\\;");
                case ',' -> sb.append("\\,");
                case '\n' -> sb.append("\\n");
                case '\r' -> {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                        i++;
                    }
                    sb.append("\\n");
                }
                default -> {
                    if (c >= 0x20 || c == '\t') {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    private static String oneLine(String s) {
        return s == null ? "" : s.replace("\r", "").replace("\n", "");
    }

    /** Appends a content line folded at 75 octets, terminated by CRLF. */
    static void line(StringBuilder out, String content) {
        int octets = 0;
        int limit = 75;
        for (int i = 0; i < content.length(); ) {
            int cp = content.codePointAt(i);
            int len = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8).length;
            if (octets + len > limit) {
                out.append("\r\n ");
                octets = 1;
                limit = 75;
            }
            out.appendCodePoint(cp);
            octets += len;
            i += Character.charCount(cp);
        }
        out.append("\r\n");
    }
}
