package de.sprachweg.common.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** A 400 problem carrying a field → message map, like bean validation failures. */
public class ValidationException extends ApiException {

    private final Map<String, String> errors;

    public ValidationException(String message, Map<String, String> errors) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
        this.errors = Map.copyOf(errors);
    }

    public Map<String, String> getErrors() {
        return errors;
    }
}
