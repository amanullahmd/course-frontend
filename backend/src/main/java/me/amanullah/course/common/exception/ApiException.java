package me.amanullah.course.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for all domain exceptions that map to an RFC 7807 problem response.
 * The {@code code} is a stable machine readable identifier for clients.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    protected ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
