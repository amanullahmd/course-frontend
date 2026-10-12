package me.amanullah.course.notification;

import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.common.web.Paging;
import me.amanullah.course.user.User;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import me.amanullah.course.common.i18n.Messages;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final MailService mail;
    private final Messages messages;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, MailService mail, Messages messages, Clock clock) {
        this.repository = repository;
        this.mail = mail;
        this.messages = messages;
        this.clock = clock;
    }

    /**
     * Creates an in-app notification in the recipient's language. Title and body come from
     * {@code <key>.title} / {@code <key>.body}; {@code reason} (optional) is appended to the body.
     */
    @Transactional
    public void notify(User user, NotificationType type, String key, String link, String reason, Object... args) {
        Locale locale = user.preferredLocale();
        String body = messages.get(locale, key + ".body", args);
        if (reason != null && !reason.isBlank()) {
            body = body + " " + messages.get(locale, "notification.reason", reason);
        }
        repository.save(new Notification(user, type, messages.get(locale, key + ".title", args), body, link,
                Instant.now(clock)));
    }

    /** Creates an in-app notification and sends an e-mail (after commit). */
    @Transactional
    public void notifyWithEmail(User user, NotificationType type, String key, String link, String reason,
                                EmailTemplates.Email email, Object... args) {
        notify(user, type, key, link, reason, args);
        mail.send(user.getEmail(), email);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationDto> list(UUID userId, Integer page, Integer size) {
        return PageResponse.of(repository.findByUserId(userId,
                Paging.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id")))), NotificationDto::of);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return repository.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(UUID userId, UUID id) {
        Notification n = repository.findByIdAndUserId(id, userId).orElseThrow(() -> NotFoundException.of("Notification"));
        if (n.getReadAt() == null) {
            n.setReadAt(Instant.now(clock));
        }
    }

    @Transactional
    public void markAllRead(UUID userId) {
        repository.markAllRead(userId, Instant.now(clock));
    }
}
