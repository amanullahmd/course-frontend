package me.amanullah.course.media;

import static org.assertj.core.api.Assertions.assertThat;

import me.amanullah.course.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaUrlSignerTest {

    private static AppProperties props() {
        return new AppProperties("http://localhost:3000", "http://api.test",
                new AppProperties.Jwt("j".repeat(40), "sprachweg", Duration.ofMinutes(15), Duration.ofDays(14)),
                new AppProperties.Auth(Duration.ofHours(24), Duration.ofHours(1), "refresh_token", false, "Lax"),
                new AppProperties.Media("m".repeat(40), Duration.ofHours(6)),
                new AppProperties.Storage("./target/x"),
                new AppProperties.Mail(false, "a <a@b.c>"),
                new AppProperties.Cors(List.of("http://localhost:3000")),
                new AppProperties.Seed(false));
    }

    private static MediaUrlSigner at(Instant now) {
        return new MediaUrlSigner(props(), Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void signsVerifiesAndExpires() {
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        MediaUrlSigner signer = at(t0);
        UUID id = UUID.randomUUID();
        long expires = signer.expiresAt();
        assertThat(expires).isGreaterThanOrEqualTo(t0.plus(Duration.ofHours(6)).getEpochSecond());
        assertThat(signer.isValid(id, expires, signer.sign(id, expires))).isTrue();
        assertThat(signer.isValid(id, expires + 1, signer.sign(id, expires))).isFalse();
        assertThat(signer.isValid(UUID.randomUUID(), expires, signer.sign(id, expires))).isFalse();
        assertThat(signer.signedUrl(id, true)).startsWith("http://api.test/api/media/" + id + "/content?expires=")
                .endsWith("&download=true");
        assertThat(at(t0.plus(Duration.ofDays(1))).isExpired(expires)).isTrue();
    }

    @Test
    void refreshesOnlyGenuineEmbeddedUrls() {
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        MediaUrlSigner old = at(t0);
        UUID id = UUID.randomUUID();
        String genuine = old.signedUrl(id, false).replace("&", "&amp;");
        String forged = "http://api.test/api/media/" + UUID.randomUUID() + "/content?expires=1&amp;sig=forged";
        String html = "<p><img src=\"" + genuine + "\"><img src=\"" + forged + "\"></p>";

        MediaUrlSigner later = at(t0.plus(Duration.ofDays(30)));
        String refreshed = later.refreshEmbeddedUrls(html);

        assertThat(refreshed).doesNotContain(genuine).contains(forged);
        assertThat(refreshed).contains("/api/media/" + id + "/content?expires=" + later.expiresAt() + "&amp;sig=");
    }
}
