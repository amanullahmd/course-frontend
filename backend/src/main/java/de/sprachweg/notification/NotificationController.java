package de.sprachweg.notification;

import de.sprachweg.common.web.PageResponse;
import de.sprachweg.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    public record UnreadCount(long count) {
    }

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<NotificationDto> list(@RequestParam(required = false) Integer page,
                                              @RequestParam(required = false) Integer size) {
        return service.list(CurrentUser.get().id(), page, size);
    }

    @GetMapping("/unread-count")
    public UnreadCount unreadCount() {
        return new UnreadCount(service.unreadCount(CurrentUser.get().id()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@PathVariable UUID id) {
        service.markRead(CurrentUser.get().id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll() {
        service.markAllRead(CurrentUser.get().id());
        return ResponseEntity.noContent().build();
    }
}
