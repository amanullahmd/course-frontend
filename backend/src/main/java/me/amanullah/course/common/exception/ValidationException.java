package me.amanullah.course.common.exception;

import java.util.LinkedHashMap;
import java.util.Map;
import me.amanullah.course.common.i18n.MessageRef;
import org.springframework.http.HttpStatus;

/** A 400 problem carrying a field → message map (message keys resolved in the request locale). */
public class ValidationException extends ApiException {

    private final Map<String, MessageRef> errors;

    public ValidationException(Map<String, MessageRef> errors) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed");
        this.errors = new LinkedHashMap<>(errors);
    }

    public static ValidationException field(String field, String key, Object... args) {
        return new ValidationException(Map.of(field, new MessageRef(key, args)));
    }

    public Map<String, MessageRef> getErrors() {
        return errors;
    }
}
