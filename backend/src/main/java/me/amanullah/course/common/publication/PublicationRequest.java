package me.amanullah.course.common.publication;

import me.amanullah.course.common.exception.ValidationException;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;

public record PublicationRequest(@NotNull PublishStatus publishStatus, Instant publishAt, Instant unpublishAt) {

    /** Validates the window and applies it to the target. */
    public void applyTo(Publishable target) {
        if (publishAt != null && unpublishAt != null && !unpublishAt.isAfter(publishAt)) {
            throw new ValidationException("unpublishAt must be after publishAt",
                    Map.of("unpublishAt", "must be after publishAt"));
        }
        target.setPublishStatus(publishStatus);
        target.setPublishAt(publishAt);
        target.setUnpublishAt(unpublishAt);
    }
}
