package me.amanullah.course.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;

/** English and German bundles must define exactly the same keys. */
class MessageBundlesTest {

    private static Properties load(String name) throws Exception {
        Properties p = new Properties();
        try (InputStream in = MessageBundlesTest.class.getResourceAsStream("/" + name)) {
            p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        return p;
    }

    @Test
    void englishAndGermanHaveTheSameKeys() throws Exception {
        Properties en = load("messages.properties");
        Properties de = load("messages_de.properties");
        assertThat(de.stringPropertyNames()).containsExactlyInAnyOrderElementsOf(en.stringPropertyNames());
        assertThat(en.getProperty("error.INTERNAL_ERROR")).isNotBlank();
        assertThat(de.getProperty("error.NOT_FOUND")).contains("nicht gefunden");
    }
}
