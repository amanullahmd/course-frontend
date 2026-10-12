package me.amanullah.course.messaging;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import me.amanullah.course.common.exception.Problems;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.messaging.MessagingDtos.ConversationDto;
import me.amanullah.course.messaging.MessagingDtos.MessageDto;
import me.amanullah.course.messaging.MessagingDtos.MessagePageDto;
import me.amanullah.course.messaging.MessagingDtos.SendMessageRequest;
import me.amanullah.course.messaging.MessagingDtos.StartConversationRequest;
import me.amanullah.course.messaging.MessagingDtos.UnreadCountDto;
import me.amanullah.course.security.CurrentUser;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Messages")
@RestController
@RequestMapping("/api/messages")
public class MessagingController {

    private final MessagingService service;
    private final Problems problems;

    public MessagingController(MessagingService service, Problems problems) {
        this.service = service;
        this.problems = problems;
    }

    /** Conversations with at least one message, most recent first; {@code q} filters by name or course title. */
    @GetMapping("/conversations")
    public PageResponse<ConversationDto> conversations(@RequestParam(required = false) String q,
                                                       @RequestParam(required = false) Integer page,
                                                       @RequestParam(required = false) Integer size) {
        return service.list(CurrentUser.get(), q, page, size);
    }

    /** Creates (or reuses) the conversation with the recipient and sends the first message. */
    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationDto start(@Valid @RequestBody StartConversationRequest request) {
        return service.start(CurrentUser.get(), request.recipientId(), request.courseId(), request.body());
    }

    /** The existing conversation with a user ({@code courseId} omitted = the general one), or 404. */
    @GetMapping("/conversations/with/{userId}")
    public ConversationDto with(@PathVariable UUID userId, @RequestParam(required = false) UUID courseId) {
        return service.findWith(CurrentUser.get(), userId, courseId);
    }

    @GetMapping("/conversations/{id}")
    public ConversationDto conversation(@PathVariable UUID id) {
        return service.get(CurrentUser.get(), id);
    }

    @GetMapping("/conversations/{id}/messages")
    public MessagePageDto messages(@PathVariable UUID id, @RequestParam(required = false) UUID before,
                                   @RequestParam(required = false) Integer size) {
        return service.messages(CurrentUser.get(), id, before, size);
    }

    @PostMapping("/conversations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto send(@PathVariable UUID id, @Valid @RequestBody SendMessageRequest request) {
        return service.post(CurrentUser.get(), id, request.body());
    }

    @PostMapping("/conversations/{id}/read")
    public ResponseEntity<Void> read(@PathVariable UUID id) {
        service.markRead(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/unread-count")
    public UnreadCountDto unreadCount() {
        return service.unread(CurrentUser.get());
    }

    @ExceptionHandler(RateLimitedException.class)
    public ResponseEntity<ProblemDetail> rateLimited(RateLimitedException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problems.of(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", LocaleContextHolder.getLocale()));
    }
}
