package me.amanullah.course.assessment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClozeParserTest {

    @Test
    void findsMarkersInOrder() {
        assertThat(ClozeParser.markers("Ich {{1}} gestern ins Kino und {{2}} einen Film.")).containsExactly(1, 2);
        assertThat(ClozeParser.distinct("{{2}} und {{ 1 }} und {{2}}")).containsExactly(1, 2);
        assertThat(ClozeParser.hasDuplicates("{{2}} und {{ 1 }} und {{2}}")).isTrue();
        assertThat(ClozeParser.hasDuplicates("{{1}} {{2}}")).isFalse();
    }

    @Test
    void ignoresMalformedMarkers() {
        assertThat(ClozeParser.markers("{{}} {1} {{a}} {{1}")).isEmpty();
        assertThat(ClozeParser.markers(null)).isEmpty();
        assertThat(ClozeParser.markers("{{12345}}")).isEmpty();
    }
}
