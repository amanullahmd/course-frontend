package me.amanullah.course.report;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Minimal RFC 4180 CSV builder: comma separated, CRLF line endings, UTF-8 with a byte order mark (so Excel detects
 * the encoding and shows umlauts correctly). Fields containing a comma, quote or line break are quoted, quotes are
 * doubled, and text starting with {@code = + - @} (or a tab/CR) gets a leading apostrophe against formula injection.
 */
final class Csv {

    static final byte[] BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneOffset.UTC);

    private final StringBuilder out = new StringBuilder();

    Csv row(Object... cells) {
        return row(Arrays.asList(cells));
    }

    Csv row(List<?> cells) {
        List<String> encoded = new ArrayList<>(cells.size());
        for (Object cell : cells) {
            encoded.add(field(cell));
        }
        out.append(String.join(",", encoded)).append("\r\n");
        return this;
    }

    byte[] toBytes() {
        byte[] body = out.toString().getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[BOM.length + body.length];
        System.arraycopy(BOM, 0, result, 0, BOM.length);
        System.arraycopy(body, 0, result, BOM.length, body.length);
        return result;
    }

    static String field(Object value) {
        if (value == null) {
            return "";
        }
        String s;
        if (value instanceof Number n) {
            s = number(n);
        } else if (value instanceof Instant i) {
            s = DATE_TIME.format(i);
        } else {
            s = value.toString();
            if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) {
                s = "'" + s;
            }
        }
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /** Numbers with a dot as decimal separator and at most one decimal ({@code 80}, {@code 72.5}). */
    static String number(Number n) {
        if (n instanceof Integer || n instanceof Long) {
            return n.toString();
        }
        double d = Math.round(n.doubleValue() * 10.0) / 10.0;
        return d == Math.rint(d) ? Long.toString((long) d) : Double.toString(d);
    }
}
