package de.sprachweg.common.publication;

import java.time.Instant;

/**
 * Effective visibility computed at request time:
 * <pre>
 * live(x) = x.publishStatus == PUBLISHED
 *           &amp;&amp; (x.publishAt == null || x.publishAt &lt;= now)
 *           &amp;&amp; (x.unpublishAt == null || x.unpublishAt &gt; now)
 * </pre>
 */
public enum Visibility {
    DRAFT, SCHEDULED, LIVE, EXPIRED;

    public static Visibility of(PublishStatus status, Instant publishAt, Instant unpublishAt, Instant now) {
        if (status != PublishStatus.PUBLISHED) {
            return DRAFT;
        }
        if (publishAt != null && publishAt.isAfter(now)) {
            return SCHEDULED;
        }
        if (unpublishAt != null && !unpublishAt.isAfter(now)) {
            return EXPIRED;
        }
        return LIVE;
    }

    public static Visibility of(Publishable p, Instant now) {
        return of(p.getPublishStatus(), p.getPublishAt(), p.getUnpublishAt(), now);
    }

    public static boolean isLive(Publishable p, Instant now) {
        return of(p, now) == LIVE;
    }
}
