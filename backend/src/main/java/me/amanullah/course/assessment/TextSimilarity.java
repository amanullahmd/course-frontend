package me.amanullah.course.assessment;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** String and sequence comparison helpers for grading (German spelling tolerance, edit distance, LCS). */
public final class TextSimilarity {

    private TextSimilarity() {
    }

    /**
     * Folds German spelling variants onto one form: umlauts and ß become their transliterations
     * (ä to ae, ö to oe, ü to ue, ß to ss), so "Mädchen" equals "Maedchen" and "Straße" equals "Strasse".
     */
    public static String foldGerman(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s, Normalizer.Form.NFC);
        StringBuilder sb = new StringBuilder(n.length() + 4);
        for (int i = 0; i < n.length(); i++) {
            char c = n.charAt(i);
            switch (c) {
                case 'ä' -> sb.append("ae");
                case 'ö' -> sb.append("oe");
                case 'ü' -> sb.append("ue");
                case 'Ä' -> sb.append("Ae");
                case 'Ö' -> sb.append("Oe");
                case 'Ü' -> sb.append("Ue");
                case 'ß' -> sb.append("ss");
                case 'ẞ' -> sb.append("SS");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /** Removes punctuation and quotation marks, keeps letters, digits and whitespace. */
    public static String stripPunctuation(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLetterOrDigit(c) || Character.isWhitespace(c)) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** Trimmed, whitespace collapsed, lower-cased unless case sensitive, optionally with German folding and no punctuation. */
    public static String normalize(String s, boolean caseSensitive, boolean lenient) {
        if (s == null) {
            return "";
        }
        String n = s.strip().replaceAll("\\s+", " ");
        if (!caseSensitive) {
            n = n.toLowerCase(Locale.ROOT);
        }
        if (lenient) {
            n = stripPunctuation(foldGerman(n)).replaceAll("\\s+", " ").strip();
        }
        return n;
    }

    public static List<String> tokens(String s, boolean caseSensitive, boolean lenient) {
        String n = normalize(s, caseSensitive, lenient);
        return n.isEmpty() ? List.of() : List.of(n.split(" "));
    }

    /** Edit distance between two sequences (insert, delete, substitute; each costs 1). */
    public static <T> int editDistance(List<T> a, List<T> b) {
        int[] prev = new int[b.size() + 1];
        int[] cur = new int[b.size() + 1];
        for (int j = 0; j <= b.size(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.size(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.size(); j++) {
                int cost = a.get(i - 1).equals(b.get(j - 1)) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.size()];
    }

    /** Character-level edit distance. */
    public static int levenshtein(String a, String b) {
        List<Character> x = new ArrayList<>(a.length());
        for (char c : a.toCharArray()) {
            x.add(c);
        }
        List<Character> y = new ArrayList<>(b.length());
        for (char c : b.toCharArray()) {
            y.add(c);
        }
        return editDistance(x, y);
    }

    /** Length of the longest common subsequence. */
    public static <T> int lcsLength(List<T> a, List<T> b) {
        int[][] dp = new int[a.size() + 1][b.size() + 1];
        for (int i = 1; i <= a.size(); i++) {
            for (int j = 1; j <= b.size(); j++) {
                dp[i][j] = a.get(i - 1).equals(b.get(j - 1)) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        return dp[a.size()][b.size()];
    }
}
