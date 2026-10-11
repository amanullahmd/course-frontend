package de.sprachweg.common;

import static org.assertj.core.api.Assertions.assertThat;

import de.sprachweg.common.util.SlugGenerator;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SlugGeneratorTest {

    @Test
    void transliteratesGermanUmlauts() {
        assertThat(SlugGenerator.slugify("Prüfungsvorbereitung Goethe B2")).isEqualTo("pruefungsvorbereitung-goethe-b2");
        assertThat(SlugGenerator.slugify("Größe & Übung: Ärger, Öl, Straße"))
                .isEqualTo("groesse-und-uebung-aerger-oel-strasse");
    }

    @Test
    void stripsPunctuationAndAccents() {
        assertThat(SlugGenerator.slugify("  Deutsch A1: Erste Schritte!  ")).isEqualTo("deutsch-a1-erste-schritte");
        assertThat(SlugGenerator.slugify("Café – Crème")).isEqualTo("cafe-creme");
    }

    @Test
    void fallsBackForEmptyInput() {
        assertThat(SlugGenerator.slugify("!!!")).isEqualTo("kurs");
        assertThat(SlugGenerator.slugify(null)).isEqualTo("kurs");
    }

    @Test
    void appendsSuffixUntilUnique() {
        Set<String> taken = Set.of("deutsch-a1", "deutsch-a1-2");
        assertThat(SlugGenerator.unique("Deutsch A1", taken::contains)).isEqualTo("deutsch-a1-3");
        assertThat(SlugGenerator.unique("Deutsch B1", taken::contains)).isEqualTo("deutsch-b1");
    }

    @Test
    void limitsLength() {
        assertThat(SlugGenerator.slugify("a".repeat(200))).hasSize(80);
    }
}
