package me.amanullah.course.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import me.amanullah.course.common.exception.ErrorClassifier.Classification;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Translates every exception into an RFC 7807 {@link ProblemDetail} with a stable {@code code}, a detail localized
 * for the request locale and, for validation failures, an {@code errors} map (field → message). Client mistakes are
 * always 4xx; only real server bugs produce a 500 (code {@code INTERNAL_ERROR}, with a {@code traceId}).
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final Problems problems;

    public GlobalExceptionHandler(Problems problems) {
        this.problems = problems;
    }

    /** Everything Spring MVC does not handle itself: domain exceptions, security, persistence, unexpected errors. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleAny(Exception ex, HttpServletRequest request) {
        if (ErrorClassifier.isClientAbort(ex)) {
            log.debug("Client aborted request {} {}: {}", request.getMethod(), request.getRequestURI(), ex.toString());
            return null;
        }
        Classification c = ErrorClassifier.classify(ex);
        if (c == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(problems.internal(ex, locale(), request.getMethod() + " " + request.getRequestURI()));
        }
        logClientError(ex, c);
        return ResponseEntity.status(c.status()).body(problems.of(c, locale()));
    }

    /** Spring MVC's own exceptions (bad JSON, 404/405/415/406, missing params, validation, upload size, …). */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        if (ErrorClassifier.isClientAbort(ex)) {
            return null;
        }
        Classification c = ErrorClassifier.classify(ex);
        if (c == null && statusCode.is4xxClientError()) {
            c = ErrorClassifier.forStatus(statusCode.value());
        }
        ProblemDetail pd;
        HttpStatusCode status;
        if (c == null) {
            String where = request instanceof ServletWebRequest swr
                    ? swr.getRequest().getMethod() + " " + swr.getRequest().getRequestURI() : request.getDescription(false);
            pd = problems.internal(ex, locale(), where);
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        } else {
            logClientError(ex, c);
            pd = problems.of(c, locale());
            status = c.status();
        }
        return createResponseEntity(pd, headers, status, request);
    }

    private static void logClientError(Exception ex, Classification c) {
        if (ex instanceof DataIntegrityViolationException d) {
            log.warn("Data integrity violation: {}", d.getMostSpecificCause().getMessage());
        } else if (log.isDebugEnabled() && !(ex instanceof ApiException)) {
            log.debug("Client error {} ({}): {}", c.status().value(), c.code(), ex.toString());
        }
    }

    private static Locale locale() {
        return LocaleContextHolder.getLocale();
    }
}
