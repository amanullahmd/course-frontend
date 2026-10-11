package me.amanullah.course.common.exception;

import java.net.URI;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import me.amanullah.course.common.exception.ErrorClassifier.Classification;
import me.amanullah.course.common.i18n.MessageRef;
import me.amanullah.course.common.i18n.Messages;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;

/**
 * Builds the RFC 7807 problem bodies used everywhere (controller advice, {@code /error}, security handlers):
 * {@code {type,title,status,detail,instance?,code,errors?,traceId?}} with a detail localized for the given locale.
 */
@Component
public class Problems {

    private static final Logger log = LoggerFactory.getLogger(Problems.class);
    static final URI ABOUT_BLANK = URI.create("about:blank");

    private final Messages messages;

    public Problems(Messages messages) {
        this.messages = messages;
    }

    public ProblemDetail of(Classification c, Locale locale) {
        ProblemDetail pd = base(c.status(), c.code(), detail(c.code(), c.messageKey(), c.args(), locale));
        if (c.errors() != null && !c.errors().isEmpty()) {
            Map<String, String> errors = new LinkedHashMap<>();
            c.errors().forEach((field, msg) -> errors.put(field, msg instanceof MessageRef ref
                    ? messages.get(locale, ref.key(), ref.args()) : String.valueOf(msg)));
            pd.setProperty("errors", errors);
        }
        return pd;
    }

    public ProblemDetail of(HttpStatus status, String code, Locale locale) {
        return of(new Classification(status, code, null, new Object[0], null), locale);
    }

    /** A 500 for an unexpected server error: generic localized message, error logged with a correlation id. */
    public ProblemDetail internal(Throwable ex, Locale locale, String where) {
        String traceId = HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextLong());
        if (ex != null) {
            log.error("Unexpected error [traceId={}] at {}", traceId, where, ex);
        } else {
            log.error("Unexpected error [traceId={}] at {}", traceId, where);
        }
        ProblemDetail pd = base(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                detail("INTERNAL_ERROR", null, new Object[0], locale));
        pd.setProperty("traceId", traceId);
        return pd;
    }

    private ProblemDetail base(HttpStatus status, String code, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setType(ABOUT_BLANK);
        pd.setTitle(status.getReasonPhrase());
        pd.setProperty("code", code);
        return pd;
    }

    /** key → error.CODE → error.NOT_FOUND (for *_NOT_FOUND) → error.CLIENT_ERROR / error.INTERNAL_ERROR. */
    private String detail(String code, String key, Object[] args, Locale locale) {
        String msg = key == null ? null : messages.find(locale, key, args);
        if (msg == null) {
            msg = messages.find(locale, "error." + code, args);
        }
        if (msg == null && code.endsWith("_NOT_FOUND")) {
            msg = messages.find(locale, "error.NOT_FOUND");
        }
        if (msg == null) {
            msg = messages.get(locale, "error.CLIENT_ERROR");
        }
        return msg;
    }
}
