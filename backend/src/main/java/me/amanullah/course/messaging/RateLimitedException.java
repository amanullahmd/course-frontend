package me.amanullah.course.messaging;

import me.amanullah.course.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 429 RATE_LIMITED; the controller adds a {@code Retry-After} header. */
public class RateLimitedException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitedException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many messages, please wait a moment");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
