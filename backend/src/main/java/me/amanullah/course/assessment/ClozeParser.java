package me.amanullah.course.assessment;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Finds the numbered blank markers {@code {{1}}}, {@code {{2}}}, ... in a CLOZE or WORD_BANK prompt. */
public final class ClozeParser {

    public static final int MAX_BLANKS = 20;
    private static final Pattern MARKER = Pattern.compile("\\{\\{\\s*(\\d{1,3})\\s*}}");

    private ClozeParser() {
    }

    /** Marker numbers in order of appearance (duplicates included). */
    public static List<Integer> markers(String prompt) {
        List<Integer> found = new ArrayList<>();
        if (prompt == null) {
            return found;
        }
        Matcher m = MARKER.matcher(prompt);
        while (m.find()) {
            found.add(Integer.parseInt(m.group(1)));
        }
        return found;
    }

    /** Distinct marker numbers, sorted ascending. */
    public static List<Integer> distinct(String prompt) {
        return markers(prompt).stream().distinct().sorted().toList();
    }

    public static boolean hasDuplicates(String prompt) {
        List<Integer> all = markers(prompt);
        return all.size() != all.stream().distinct().count();
    }
}
