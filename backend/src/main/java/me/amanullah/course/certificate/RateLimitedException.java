package me.amanullah.course.certificate;

import me.amanullah.course.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 429 {@code RATE_LIMITED}: too many verification requests from one client. */
public class RateLimitedException extends ApiException {

    public RateLimitedException() {
        super(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests");
    }
}
