package de.sprachweg.media;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code url} is an absolute, signed, time-limited URL (inline). {@code downloadUrl} is an addition to the
 * contract: the same signed URL with {@code download=true} (Content-Disposition: attachment).
 */
public record MediaDto(UUID id, String fileName, String contentType, long sizeBytes, MediaKind kind, String url,
                       String downloadUrl, Instant createdAt) {
}
