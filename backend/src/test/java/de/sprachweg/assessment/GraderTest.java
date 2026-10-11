package de.sprachweg.assessment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GraderTest {

    @Test
    void normalizeTrimsCollapsesAndLowercases() {
        assertThat(Grader.normalize("  Ich   BIN\tLuca ", false)).isEqualTo("ich bin luca");
        assertThat(Grader.normalize("  Ich   BIN ", true)).isEqualTo("Ich BIN");
        assertThat(Grader.normalize(null, false)).isEmpty();
    }

    @Test
    void percentIsRoundedToOneDecimal() {
        assertThat(Grader.percent(2.0, 3.0)).isEqualTo(66.7);
        assertThat(Grader.percent(0.0, 0.0)).isEqualTo(100.0);
        assertThat(Grader.percent(null, 5.0)).isNull();
    }
}
