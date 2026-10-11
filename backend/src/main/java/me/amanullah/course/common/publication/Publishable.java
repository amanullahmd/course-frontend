package me.amanullah.course.common.publication;

import java.time.Instant;

public interface Publishable {

    PublishStatus getPublishStatus();

    Instant getPublishAt();

    Instant getUnpublishAt();

    void setPublishStatus(PublishStatus status);

    void setPublishAt(Instant publishAt);

    void setUnpublishAt(Instant unpublishAt);
}
