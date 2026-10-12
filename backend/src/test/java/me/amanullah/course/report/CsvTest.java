package me.amanullah.course.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CsvTest {

    @Test
    void quotesEscapesAndNeutralizesFormulas() {
        assertThat(Csv.field("plain")).isEqualTo("plain");
        assertThat(Csv.field("a,b")).isEqualTo("\"a,b\"");
        assertThat(Csv.field("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(Csv.field("line\nbreak")).isEqualTo("\"line\nbreak\"");
        assertThat(Csv.field("=SUM(A1)")).isEqualTo("'=SUM(A1)");
        assertThat(Csv.field("@cmd")).isEqualTo("'@cmd");
        assertThat(Csv.field(null)).isEmpty();
        assertThat(Csv.field(72.5)).isEqualTo("72.5");
        assertThat(Csv.field(80.0)).isEqualTo("80");
        assertThat(Csv.field(-3)).isEqualTo("-3");
        assertThat(Csv.field(Instant.parse("2026-10-12T08:15:30Z"))).isEqualTo("2026-10-12 08:15");
    }

    @Test
    void writesBomAndCrlf() {
        byte[] bytes = new Csv().row("Prüfung", 1).row("ß", null).toBytes();
        assertThat(bytes).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        assertThat(new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8)).isEqualTo("Prüfung,1\r\nß,\r\n");
    }
}
