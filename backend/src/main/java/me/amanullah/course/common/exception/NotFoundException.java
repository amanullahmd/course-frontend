package me.amanullah.course.common.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

    public NotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }

    public NotFoundException(String message) {
        this("NOT_FOUND", message);
    }

    public static NotFoundException of(String entity) {
        return new NotFoundException(entity.toUpperCase().replace(' ', '_') + "_NOT_FOUND", entity + " not found");
    }
}
