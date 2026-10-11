package me.amanullah.course.common.publication;

import me.amanullah.course.common.exception.ValidationException;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record PublicationRequest(@NotNull PublishStatus publishStatus, Instant publishAt, Instant unpublishAt) {

    /** Validates the window and applies it to the target. */
    public void applyTo(Publishable target) {
        if (publishAt != null && unpublishAt != null && !unpublishAt.isAfter(publishAt)) {
            throw ValidationException.field("unpublishAt", "validation.unpublishAfterPublish");
        }
        target.setPublishStatus(publishStatus);
        target.setPublishAt(publishAt);
        target.setUnpublishAt(unpublishAt);
    }
}
