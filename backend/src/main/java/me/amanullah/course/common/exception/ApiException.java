package me.amanullah.course.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for all domain exceptions that map to an RFC 7807 problem response.
 * The {@code code} is a stable machine readable identifier for clients. The {@code detail} is localized from
 * {@code messages*.properties}: first {@link #getMessageKey()} (if set), then {@code error.<CODE>}, then
 * {@code error.NOT_FOUND} for {@code *_NOT_FOUND} codes, finally the (English) exception message.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private String messageKey;
    private Object[] args = new Object[0];
    private java.util.Map<String, Object> properties;

    protected ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /** Uses a more specific message key (and arguments) for the localized detail. */
    public ApiException key(String messageKey, Object... args) {
        this.messageKey = messageKey;
        this.args = args;
        return this;
    }

    /** Adds an extra machine-readable property to the problem body (e.g. {@code unlockAt}). */
    public ApiException property(String name, Object value) {
        if (properties == null) {
            properties = new java.util.LinkedHashMap<>();
        }
        properties.put(name, value);
        return this;
    }

    public java.util.Map<String, Object> getProperties() {
        return properties;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getMessageKey() {
        return messageKey;
    }

    public Object[] getArgs() {
        return args;
    }
}
