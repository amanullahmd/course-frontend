package me.amanullah.course.common.exception;

import jakarta.servlet.ServletException;
import jakarta.validation.ConstraintViolationException;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import me.amanullah.course.common.i18n.MessageRef;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.firewall.RequestRejectedException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestCookieException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Maps exceptions caused by the client to a status, a stable {@code code}, a message key and optional field errors.
 * Returns {@code null} for anything that is not a client error (a server bug → 500).
 */
public final class ErrorClassifier {

    /**
     * @param errors field → message; values are either already localized strings (bean validation) or
     *               {@link MessageRef}s that are resolved in the request locale
     */
    public record Classification(HttpStatus status, String code, String messageKey, Object[] args,
                                 Map<String, Object> errors) {

        static Classification of(HttpStatus status, String code) {
            return new Classification(status, code, null, new Object[0], null);
        }

        static Classification of(HttpStatus status, String code, String key, Object... args) {
            return new Classification(status, code, key, args, null);
        }

        Classification withErrors(Map<String, Object> errors) {
            return new Classification(status, code, messageKey, args, errors);
        }
    }

    private ErrorClassifier() {
    }

    public static Classification classify(Throwable ex) {
        if (ex == null) {
            return null;
        }
        if (ex instanceof ValidationException v) {
            return new Classification(v.getStatus(), v.getCode(), v.getMessageKey(), v.getArgs(),
                    new LinkedHashMap<>(v.getErrors()));
        }
        if (ex instanceof ApiException a) {
            return new Classification(a.getStatus(), a.getCode(), a.getMessageKey(), a.getArgs(), null);
        }
        if (ex instanceof MethodArgumentNotValidException m) {
            return validation(m.getBindingResult());
        }
        if (ex instanceof HandlerMethodValidationException h) {
            Map<String, Object> errors = new LinkedHashMap<>();
            h.getParameterValidationResults().forEach(r -> {
                String name = r.getMethodParameter().getParameterName();
                r.getResolvableErrors().forEach(e -> errors.putIfAbsent(name == null ? "param" : name, e.getDefaultMessage()));
            });
            return Classification.of(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED").withErrors(errors);
        }
        if (ex instanceof ConstraintViolationException c) {
            Map<String, Object> errors = new LinkedHashMap<>();
            c.getConstraintViolations().forEach(v -> errors.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
            return Classification.of(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED").withErrors(errors);
        }
        if (ex instanceof HttpMessageNotReadableException) {
            return Classification.of(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST");
        }
        if (ex instanceof MaxUploadSizeExceededException || isSizeLimit(ex)) {
            return Classification.of(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE");
        }
        if (ex instanceof MissingServletRequestPartException p) {
            return Classification.of(HttpStatus.BAD_REQUEST, "FILE_REQUIRED")
                    .withErrors(Map.of(p.getRequestPartName(), new MessageRef("validation.required")));
        }
        if (ex instanceof MultipartException) {
            return Classification.of(HttpStatus.BAD_REQUEST, "FILE_REQUIRED");
        }
        if (ex instanceof MissingServletRequestParameterException p) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "error.BAD_REQUEST.missingParameter",
                    p.getParameterName()).withErrors(Map.of(p.getParameterName(), new MessageRef("validation.required")));
        }
        if (ex instanceof MissingRequestHeaderException h) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "error.BAD_REQUEST.missingHeader",
                    h.getHeaderName());
        }
        if (ex instanceof MissingRequestCookieException c) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "error.BAD_REQUEST.missingCookie",
                    c.getCookieName());
        }
        if (ex instanceof ServletRequestBindingException) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
        }
        if (ex instanceof TypeMismatchException t) {
            String name = t.getPropertyName() != null ? t.getPropertyName() : "value";
            if (t instanceof org.springframework.web.method.annotation.MethodArgumentTypeMismatchException m) {
                name = m.getName();
            }
            return Classification.of(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "error.INVALID_PARAMETER", name)
                    .withErrors(Map.of(name, new MessageRef("validation.invalidValue")));
        }
        if (ex instanceof NoResourceFoundException || ex instanceof NoHandlerFoundException) {
            return Classification.of(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        if (ex instanceof HttpRequestMethodNotSupportedException) {
            return Classification.of(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED");
        }
        if (ex instanceof HttpMediaTypeNotSupportedException) {
            return Classification.of(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE");
        }
        if (ex instanceof HttpMediaTypeNotAcceptableException) {
            return Classification.of(HttpStatus.NOT_ACCEPTABLE, "NOT_ACCEPTABLE");
        }
        if (ex instanceof AsyncRequestTimeoutException) {
            return Classification.of(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE");
        }
        if (ex instanceof OptimisticLockingFailureException || ex instanceof jakarta.persistence.OptimisticLockException) {
            return Classification.of(HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION");
        }
        if (ex instanceof DataIntegrityViolationException) {
            return Classification.of(HttpStatus.CONFLICT, "CONFLICT");
        }
        if (ex instanceof AccessDeniedException) {
            return Classification.of(HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
        if (ex instanceof AuthenticationException) {
            return Classification.of(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        }
        if (ex instanceof RequestRejectedException) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "error.BAD_REQUEST.rejectedUrl");
        }
        if (ex instanceof IllegalArgumentException) {
            return Classification.of(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
        }
        if (ex instanceof ServletException && ex.getCause() != null && ex.getCause() != ex) {
            return classify(ex.getCause());
        }
        return null;
    }

    /** Classification for an HTTP status without exception (e.g. {@code sendError} from a filter or the container). */
    public static Classification forStatus(int status) {
        HttpStatus s = HttpStatus.resolve(status);
        if (s == null) {
            s = status >= 500 ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.BAD_REQUEST;
        }
        String code = switch (s) {
            case CONTENT_TOO_LARGE -> "FILE_TOO_LARGE";
            case INTERNAL_SERVER_ERROR -> "INTERNAL_ERROR";
            default -> s.is5xxServerError() ? "INTERNAL_ERROR" : s.name();
        };
        return Classification.of(s, code);
    }

    private static Classification validation(BindingResult result) {
        Map<String, Object> errors = new LinkedHashMap<>();
        for (FieldError fe : result.getFieldErrors()) {
            errors.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        result.getGlobalErrors().forEach(ge -> errors.putIfAbsent(ge.getObjectName(), ge.getDefaultMessage()));
        return Classification.of(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED").withErrors(errors);
    }

    private static boolean isSizeLimit(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            String name = t.getClass().getSimpleName();
            if (t instanceof MaxUploadSizeExceededException || name.equals("SizeLimitExceededException")
                    || name.equals("FileSizeLimitExceededException") || name.equals("FileCountLimitExceededException")) {
                return true;
            }
            if (t instanceof IllegalStateException && t.getMessage() != null
                    && t.getMessage().toLowerCase(Locale.ROOT).contains("exceeds its maximum permitted size")) {
                return true;
            }
        }
        return false;
    }

    /** The client went away (broken pipe, connection reset, aborted request): nothing to respond. */
    public static boolean isClientAbort(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof AsyncRequestNotUsableException || t.getClass().getSimpleName().equals("ClientAbortException")
                    || t.getClass().getSimpleName().equals("EOFException")) {
                return true;
            }
            if (t instanceof IOException && t.getMessage() != null) {
                String msg = t.getMessage().toLowerCase(Locale.ROOT);
                if (msg.contains("broken pipe") || msg.contains("connection reset") || msg.contains("connection abort")) {
                    return true;
                }
            }
        }
        return false;
    }
}
