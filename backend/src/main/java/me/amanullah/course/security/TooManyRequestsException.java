package me.amanullah.course.security;

import me.amanullah.course.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/**
 * 429 {@code RATE_LIMITED} raised by {@link RateLimiter}. {@link SecurityExceptionAdvice} adds the
 * {@code Retry-After} header and a {@code retryAfterSeconds} property to the problem response.
 */
public class TooManyRequestsException extends ApiException {

    private final long retryAfterSeconds;

    public TooManyRequestsException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests, please try again later");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
        key("error.RATE_LIMITED.retry", this.retryAfterSeconds);
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
