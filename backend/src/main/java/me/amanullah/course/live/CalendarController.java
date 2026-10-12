package me.amanullah.course.live;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.Duration;

/** Public, token-authenticated iCalendar feed (calendar apps cannot send a bearer token). */
@Tag(name = "Calendar")
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private static final MediaType ICS = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    private final CalendarService calendar;

    public CalendarController(CalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping(value = "/{token}.ics", produces = "text/calendar;charset=UTF-8")
    public ResponseEntity<String> feed(@PathVariable String token) {
        return calendar.feed(token)
                .map(body -> ResponseEntity.ok()
                        .contentType(ICS)
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"sprachweg.ics\"")
                        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                        .body(body))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
