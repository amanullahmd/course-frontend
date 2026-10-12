package me.amanullah.course.flashcard;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * CSV import and export of decks. Columns: {@code front;back;article;plural;example}. UTF-8 (a BOM is ignored), the
 * delimiter is a semicolon or a tab (detected from the first non-empty line), fields may be quoted with {@code "}
 * (doubled quotes escape a quote, quoted fields may span lines). An optional header line ({@code front;back;...}) is
 * skipped. Rows with problems are reported with their line number and a stable code, the other rows are still parsed.
 */
public final class FlashcardCsv {

    public static final int MAX_CARDS = 2000;
    public static final int MAX_FRONT = 500;
    public static final int MAX_BACK = 500;
    public static final int MAX_PLURAL = 200;
    public static final int MAX_EXAMPLE = 1000;

    private FlashcardCsv() {
    }

    public record Card(String front, String back, String article, String plural, String example) {
    }

    /** {@code line} is the 1-based line where the row starts; {@code code} is a stable identifier for the client. */
    public record RowError(int line, String field, String code) {
    }

    public record Result(List<Card> cards, List<RowError> errors, int rows) {
    }

    public static Result parse(String text) {
        List<Card> cards = new ArrayList<>();
        List<RowError> errors = new ArrayList<>();
        if (text == null) {
            return new Result(cards, errors, 0);
        }
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        char delimiter = detectDelimiter(text);
        List<Row> rows = split(text, delimiter);
        int count = 0;
        boolean first = true;
        for (Row row : rows) {
            List<String> cells = row.cells();
            if (cells.stream().allMatch(String::isBlank)) {
                continue;
            }
            if (first) {
                first = false;
                if (isHeader(cells)) {
                    continue;
                }
            }
            count++;
            String front = cell(cells, 0);
            String back = cell(cells, 1);
            String article = cell(cells, 2);
            String plural = cell(cells, 3);
            String example = cell(cells, 4);
            boolean ok = true;
            if (front.isEmpty()) {
                errors.add(new RowError(row.line(), "front", "REQUIRED"));
                ok = false;
            } else if (front.length() > MAX_FRONT) {
                errors.add(new RowError(row.line(), "front", "TOO_LONG"));
                ok = false;
            }
            if (back.isEmpty()) {
                errors.add(new RowError(row.line(), "back", "REQUIRED"));
                ok = false;
            } else if (back.length() > MAX_BACK) {
                errors.add(new RowError(row.line(), "back", "TOO_LONG"));
                ok = false;
            }
            String normalizedArticle = normalizeArticle(article);
            if (normalizedArticle == null && !article.isEmpty() && !article.equals("-")) {
                errors.add(new RowError(row.line(), "article", "ARTICLE_INVALID"));
                ok = false;
            }
            if (plural.length() > MAX_PLURAL) {
                errors.add(new RowError(row.line(), "plural", "TOO_LONG"));
                ok = false;
            }
            if (example.length() > MAX_EXAMPLE) {
                errors.add(new RowError(row.line(), "example", "TOO_LONG"));
                ok = false;
            }
            if (ok) {
                cards.add(new Card(front, back, normalizedArticle, plural.isEmpty() ? null : plural,
                        example.isEmpty() ? null : example));
            }
        }
        return new Result(cards, errors, count);
    }

    /** "der", "Die", "DAS" to lower case; null for anything else (including blank). */
    public static String normalizeArticle(String article) {
        if (article == null) {
            return null;
        }
        String a = article.strip().toLowerCase(Locale.ROOT);
        return a.equals("der") || a.equals("die") || a.equals("das") ? a : null;
    }

    public static byte[] export(List<Card> cards) {
        StringBuilder sb = new StringBuilder("front;back;article;plural;example\r\n");
        for (Card c : cards) {
            sb.append(field(c.front())).append(';').append(field(c.back())).append(';')
                    .append(field(c.article())).append(';').append(field(c.plural())).append(';')
                    .append(field(c.example())).append("\r\n");
        }
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[body.length + 3];
        out[0] = (byte) 0xEF;
        out[1] = (byte) 0xBB;
        out[2] = (byte) 0xBF;
        System.arraycopy(body, 0, out, 3, body.length);
        return out;
    }

    private static String field(String value) {
        if (value == null) {
            return "";
        }
        String s = value;
        if (!s.isEmpty() && "=@+\t\r".indexOf(s.charAt(0)) >= 0) {
            s = "'" + s; // spreadsheet formula injection guard; stripped again on import
        }
        if (s.contains(";") || s.contains("\"") || s.contains("\n") || s.contains("\r") || s.contains("\t")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /** Trims and drops control characters (except line breaks and tabs), which databases and browsers dislike. */
    public static String clean(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c >= 0x20 && c != 0x7F || c == '\n' || c == '\t') {
                sb.append(c);
            }
        }
        return sb.toString().strip();
    }

    private static boolean isHeader(List<String> cells) {
        String a = cell(cells, 0).toLowerCase(Locale.ROOT);
        String b = cell(cells, 1).toLowerCase(Locale.ROOT);
        return (a.equals("front") || a.equals("vorderseite")) && (b.equals("back") || b.equals("rückseite"));
    }

    private static String cell(List<String> cells, int i) {
        if (i >= cells.size()) {
            return "";
        }
        String s = clean(cells.get(i));
        if (s.length() > 1 && s.charAt(0) == '\'' && "=@+\t\r".indexOf(s.charAt(1)) >= 0) {
            s = s.substring(1);
        }
        return s;
    }

    private static char detectDelimiter(String text) {
        for (String line : text.split("\r\n|\r|\n", -1)) {
            if (line.isBlank()) {
                continue;
            }
            return line.indexOf('\t') >= 0 && line.indexOf(';') < 0 ? '\t' : ';';
        }
        return ';';
    }

    private record Row(int line, List<String> cells) {
    }

    private static List<Row> split(String text, char delimiter) {
        List<Row> rows = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        boolean wasQuoted = false;
        int line = 1;
        int rowLine = 1;
        int n = text.length();
        for (int i = 0; i < n; i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < n && text.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    if (ch == '\n') {
                        line++;
                    }
                    cur.append(ch);
                }
                continue;
            }
            if (ch == '"' && cur.toString().isBlank() && !wasQuoted) {
                quoted = true;
                wasQuoted = true;
                cur.setLength(0);
            } else if (ch == delimiter) {
                cells.add(cur.toString());
                cur.setLength(0);
                wasQuoted = false;
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < n && text.charAt(i + 1) == '\n') {
                    i++;
                }
                cells.add(cur.toString());
                rows.add(new Row(rowLine, cells));
                cells = new ArrayList<>();
                cur.setLength(0);
                wasQuoted = false;
                line++;
                rowLine = line;
            } else {
                cur.append(ch);
            }
        }
        if (cur.length() > 0 || !cells.isEmpty() || wasQuoted) {
            cells.add(cur.toString());
            rows.add(new Row(rowLine, cells));
        }
        return rows;
    }
}
