package me.amanullah.course.certificate;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Certificate codes like {@code SW-2026-7KQ4-M9XP-R2TA}: the issue year plus 12 random Crockford base32 characters
 * (digits and letters without I, L, O, U) = 60 bits from {@link SecureRandom}, so codes cannot be guessed.
 */
public final class CertificateCodes {

    private static final char[] SYMBOLS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
    private static final String GROUP = "[0-9A-HJKMNP-TV-Z]{4}";
    private static final Pattern FORMAT = Pattern.compile("SW-\\d{4}-" + GROUP + "-" + GROUP + "-" + GROUP);
    private static final SecureRandom RANDOM = new SecureRandom();

    private CertificateCodes() {
    }

    public static String generate(Instant issuedAt) {
        int year = issuedAt.atZone(ZoneOffset.UTC).getYear();
        StringBuilder sb = new StringBuilder("SW-").append(year);
        for (int group = 0; group < 3; group++) {
            sb.append('-');
            for (int i = 0; i < 4; i++) {
                sb.append(SYMBOLS[RANDOM.nextInt(SYMBOLS.length)]);
            }
        }
        return sb.toString();
    }

    /** Upper-cased, trimmed code, or {@code null} when the input cannot be a certificate code. */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String code = raw.strip().toUpperCase(Locale.ROOT);
        return FORMAT.matcher(code).matches() ? code : null;
    }
}
