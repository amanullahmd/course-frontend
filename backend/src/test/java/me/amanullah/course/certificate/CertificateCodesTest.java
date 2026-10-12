package me.amanullah.course.certificate;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CertificateCodesTest {

    @Test
    void codesAreWellFormedUniqueAndNormalizable() {
        Instant now = Instant.parse("2026-10-12T10:00:00Z");
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 2000; i++) {
            String code = CertificateCodes.generate(now);
            assertThat(code).matches("SW-2026-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}");
            assertThat(seen.add(code)).isTrue();
            assertThat(CertificateCodes.normalize(" " + code.toLowerCase() + " ")).isEqualTo(code);
        }
    }

    @Test
    void normalizeRejectsAnythingElse() {
        assertThat(CertificateCodes.normalize(null)).isNull();
        assertThat(CertificateCodes.normalize("")).isNull();
        assertThat(CertificateCodes.normalize("SW-2026-ABCD-EFGH")).isNull();
        assertThat(CertificateCodes.normalize("SW-2026-ILOU-0000-0000")).isNull();
        assertThat(CertificateCodes.normalize("XX-2026-ABCD-EFGH-JKMN")).isNull();
        assertThat(CertificateCodes.normalize("SW-2026-ABCD-EFGH-JKMN")).isEqualTo("SW-2026-ABCD-EFGH-JKMN");
    }
}
