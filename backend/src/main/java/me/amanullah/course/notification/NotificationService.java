package me.amanullah.course.notification;

import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.common.web.Paging;
import me.amanullah.course.user.User;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final MailService mail;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, MailService mail, Clock clock) {
        this.repository = repository;
        this.mail = mail;
        this.clock = clock;
    }

    /** Creates an in-app notification. */
    @Transactional
    public void notify(User user, NotificationType type, String title, String body, String link) {
        repository.save(new Notification(user, type, title, body, link, Instant.now(clock)));
    }

    /** Creates an in-app notification and sends an e-mail (after commit). */
    @Transactional
    public void notifyWithEmail(User user, NotificationType type, String title, String body, String link,
                                EmailTemplates.Email email) {
        notify(user, type, title, body, link);
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
