package me.amanullah.course.assessment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class TextSimilarityTest {

    @Test
    void foldGermanTransliteratesUmlautsAndEszett() {
        assertThat(TextSimilarity.foldGerman("Mädchen")).isEqualTo("Maedchen");
        assertThat(TextSimilarity.foldGerman("Größe Füße ÖL")).isEqualTo("Groesse Fuesse OeL");
        assertThat(TextSimilarity.foldGerman(null)).isEmpty();
        // decomposed input (a + combining diaeresis) is composed first
        assertThat(TextSimilarity.foldGerman("ä")).isEqualTo("ae");
    }

    @Test
    void normalizeCombinesCaseWhitespaceFoldingAndPunctuation() {
        assertThat(TextSimilarity.normalize("  Das   MÄDCHEN, schläft! ", false, true)).isEqualTo("das maedchen schlaeft");
        assertThat(TextSimilarity.normalize("  Das   MÄDCHEN, ", false, false)).isEqualTo("das mädchen,");
        assertThat(TextSimilarity.normalize("Ja", true, false)).isEqualTo("Ja");
        assertThat(TextSimilarity.normalize("„Hallo“ – du?", false, true)).isEqualTo("hallo du");
    }

    @Test
    void tokensSplitOnWhitespace() {
        assertThat(TextSimilarity.tokens("Ich  bin müde.", false, true)).containsExactly("ich", "bin", "muede");
        assertThat(TextSimilarity.tokens("   ", false, true)).isEmpty();
    }

    @Test
    void editDistanceAndLevenshtein() {
        assertThat(TextSimilarity.levenshtein("kitten", "sitting")).isEqualTo(3);
        assertThat(TextSimilarity.levenshtein("", "abc")).isEqualTo(3);
        assertThat(TextSimilarity.levenshtein("same", "same")).isZero();
        assertThat(TextSimilarity.editDistance(List.of("a", "b", "c"), List.of("a", "c"))).isEqualTo(1);
        assertThat(TextSimilarity.editDistance(List.<String>of(), List.<String>of())).isZero();
    }

    @Test
    void longestCommonSubsequence() {
        assertThat(TextSimilarity.lcsLength(List.of(1, 2, 3, 4), List.of(1, 2, 3, 4))).isEqualTo(4);
        assertThat(TextSimilarity.lcsLength(List.of(4, 3, 2, 1), List.of(1, 2, 3, 4))).isEqualTo(1);
        assertThat(TextSimilarity.lcsLength(List.of(2, 1, 3, 4), List.of(1, 2, 3, 4))).isEqualTo(3);
        assertThat(TextSimilarity.lcsLength(List.<Integer>of(), List.of(1))).isZero();
    }
}
