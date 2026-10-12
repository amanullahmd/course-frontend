package me.amanullah.course.security;

import me.amanullah.course.common.exception.ErrorClassifier;
import me.amanullah.course.common.exception.Problems;
import me.amanullah.course.media.QuotaExceededException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Problem responses that carry extra data: 429 {@code RATE_LIMITED} gets a {@code Retry-After} header and a
 * {@code retryAfterSeconds} property; 413 {@code QUOTA_EXCEEDED} gets {@code usedBytes}, {@code quotaBytes} and
 * {@code fileBytes}. Runs before the global handler.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityExceptionAdvice {

    private final Problems problems;

    public SecurityExceptionAdvice(Problems problems) {
        this.problems = problems;
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ProblemDetail> rateLimited(TooManyRequestsException ex) {
        ProblemDetail pd = problems.of(ErrorClassifier.classify(ex), LocaleContextHolder.getLocale());
        pd.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());
        return ResponseEntity.status(ex.getStatus())
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .body(pd);
    }

    @ExceptionHandler(QuotaExceededException.class)
    public ResponseEntity<ProblemDetail> quotaExceeded(QuotaExceededException ex) {
        ProblemDetail pd = problems.of(ErrorClassifier.classify(ex), LocaleContextHolder.getLocale());
        pd.setProperty("usedBytes", ex.getUsedBytes());
        pd.setProperty("quotaBytes", ex.getQuotaBytes());
        pd.setProperty("fileBytes", ex.getFileBytes());
        return ResponseEntity.status(ex.getStatus()).body(pd);
    }
}
