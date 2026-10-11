package me.amanullah.course.common;

import static org.assertj.core.api.Assertions.assertThat;

import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.publication.Visibility;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class VisibilityTest {

    private static final Instant NOW = Instant.parse("2026-05-01T10:00:00Z");
    private static final Instant PAST = NOW.minus(Duration.ofHours(1));
    private static final Instant FUTURE = NOW.plus(Duration.ofHours(1));

    @Test
    void draftIsAlwaysDraft() {
        assertThat(Visibility.of(PublishStatus.DRAFT, null, null, NOW)).isEqualTo(Visibility.DRAFT);
        assertThat(Visibility.of(PublishStatus.DRAFT, PAST, FUTURE, NOW)).isEqualTo(Visibility.DRAFT);
    }

    @Test
    void publishedWithoutWindowIsLive() {
        assertThat(Visibility.of(PublishStatus.PUBLISHED, null, null, NOW)).isEqualTo(Visibility.LIVE);
    }

    @Test
    void publishAtInFutureIsScheduled() {
        assertThat(Visibility.of(PublishStatus.PUBLISHED, FUTURE, null, NOW)).isEqualTo(Visibility.SCHEDULED);
    }

    @Test
    void publishAtNowIsLive() {
        assertThat(Visibility.of(PublishStatus.PUBLISHED, NOW, null, NOW)).isEqualTo(Visibility.LIVE);
    }

    @Test
    void unpublishAtReachedIsExpired() {
        assertThat(Visibility.of(PublishStatus.PUBLISHED, PAST, NOW, NOW)).isEqualTo(Visibility.EXPIRED);
        assertThat(Visibility.of(PublishStatus.PUBLISHED, null, PAST, NOW)).isEqualTo(Visibility.EXPIRED);
    }

    @Test
    void insideWindowIsLive() {
        assertThat(Visibility.of(PublishStatus.PUBLISHED, PAST, FUTURE, NOW)).isEqualTo(Visibility.LIVE);
    }
}
