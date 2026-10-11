package de.sprachweg.common.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;

/** Creates URL slugs from titles, transliterating German umlauts (ä→ae, ö→oe, ü→ue, ß→ss). */
public final class SlugGenerator {

    private static final int MAX_LENGTH = 80;

    private SlugGenerator() {
    }

    public static String slugify(String input) {
        if (input == null) {
            return "kurs";
        }
        String s = input.trim()
                .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
                .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
                .replace("ẞ", "SS").replace("ß", "ss");
        s = Normalizer.normalize(s, Normalizer.Form.NFKD).replaceAll("\\p{M}+", "");
        s = s.toLowerCase(Locale.ROOT)
                .replace("&", " und ")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+)|(-+$)", "");
        if (s.length() > MAX_LENGTH) {
            s = s.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        }
        return s.isEmpty() ? "kurs" : s;
    }

    /** Returns a slug that is not taken according to {@code exists}, appending -2, -3, … when needed. */
    public static String unique(String title, Predicate<String> exists) {
        String base = slugify(title);
        String candidate = base;
        int n = 2;
        while (exists.test(candidate)) {
            candidate = base + "-" + n++;
        }
        return candidate;
    }
}
