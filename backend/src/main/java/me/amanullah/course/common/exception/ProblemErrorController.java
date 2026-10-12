package me.amanullah.course.common.exception;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import me.amanullah.course.common.exception.ErrorClassifier.Classification;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.LocaleResolver;

/**
 * Replaces Boot's BasicErrorController: errors raised outside Spring MVC (filters, {@code sendError}, the servlet
 * container) and direct requests to {@code /error} get the same ProblemDetail JSON as everything else.
 */
@RestController
public class ProblemErrorController implements ErrorController {

    private final Problems problems;
    private final LocaleResolver localeResolver;

    public ProblemErrorController(Problems problems, LocaleResolver localeResolver) {
        this.problems = problems;
        this.localeResolver = localeResolver;
    }

    // The error endpoint must answer for every HTTP method (errors happen on GET, POST, PUT, DELETE …) and only
    // renders a problem document, so restricting the method (Semgrep's CSRF concern) does not apply here.
    // nosemgrep: unrestricted-request-mapping
    @RequestMapping(value = "${server.error.path:/error}", produces = {MediaType.APPLICATION_PROBLEM_JSON_VALUE,
            MediaType.APPLICATION_JSON_VALUE, MediaType.ALL_VALUE})
    public ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
        var locale = localeResolver.resolveLocale(request);
        Object statusAttr = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Throwable ex = (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
        Object uri = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        if (statusAttr == null && ex == null) {
            // a direct request to /error: there is nothing here
            return problem(problems.of(HttpStatus.NOT_FOUND, "NOT_FOUND", locale));
        }
        if (ex != null && ErrorClassifier.isClientAbort(ex)) {
            return ResponseEntity.noContent().build();
        }
        Classification c = ErrorClassifier.classify(ex);
        if (c == null) {
            int status = statusAttr instanceof Integer i ? i : 500;
            if (ex != null || status >= 500) {
                return problem(withInstance(problems.internal(ex, locale, String.valueOf(uri)), uri));
            }
            c = ErrorClassifier.forStatus(status);
        }
        return problem(withInstance(problems.of(c, locale), uri));
    }

    private static ProblemDetail withInstance(ProblemDetail pd, Object uri) {
        if (uri != null) {
            try {
                pd.setInstance(java.net.URI.create(String.valueOf(uri)));
            } catch (IllegalArgumentException ignored) {
                // the rejected URI is not a valid URI: omit "instance"
            }
        }
        return pd;
    }

    private static ResponseEntity<ProblemDetail> problem(ProblemDetail pd) {
        return ResponseEntity.status(pd.getStatus()).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }
}
