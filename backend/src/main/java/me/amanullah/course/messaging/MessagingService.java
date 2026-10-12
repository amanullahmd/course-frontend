package me.amanullah.course.messaging;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.common.web.Paging;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.messaging.MessagingDtos.ConversationDto;
import me.amanullah.course.messaging.MessagingDtos.CourseRefDto;
import me.amanullah.course.messaging.MessagingDtos.LastMessageDto;
import me.amanullah.course.messaging.MessagingDtos.MessageDto;
import me.amanullah.course.messaging.MessagingDtos.MessagePageDto;
import me.amanullah.course.messaging.MessagingDtos.ParticipantDto;
import me.amanullah.course.messaging.MessagingDtos.UnreadCountDto;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import me.amanullah.course.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Direct messages between instructors and learners (and admins). Every new message creates an in-app notification
 * unless the recipient still has an unread one for the same conversation; e-mails are sent by
 * {@link MessageMailJob} (delayed and throttled).
 */
@Service
public class MessagingService {

    public static final int DEFAULT_PAGE_SIZE = 30;

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final MessageNotificationRepository messageNotifications;
    private final UserRepository users;
    private final CourseRepository courses;
    private final MessagingPolicy policy;
    private final MessageRateLimiter rateLimiter;
    private final NotificationService notifications;
    private final UserMapper userMapper;
    private final Clock clock;

    public MessagingService(ConversationRepository conversations, MessageRepository messages,
                            MessageNotificationRepository messageNotifications, UserRepository users,
                            CourseRepository courses, MessagingPolicy policy, MessageRateLimiter rateLimiter,
                            NotificationService notifications, UserMapper userMapper, Clock clock) {
        this.conversations = conversations;
        this.messages = messages;
        this.messageNotifications = messageNotifications;
        this.users = users;
        this.courses = courses;
        this.policy = policy;
        this.rateLimiter = rateLimiter;
        this.notifications = notifications;
        this.userMapper = userMapper;
        this.clock = clock;
    }

    public static String link(UUID conversationId) {
        return "/messages/" + conversationId;
    }

    // ---------------- conversations ----------------

    @Transactional(readOnly = true)
    public PageResponse<ConversationDto> list(CurrentUser me, String q, Integer page, Integer size) {
        String pattern = q == null || q.isBlank() ? null
                : "%" + q.strip().toLowerCase(Locale.ROOT).replace("\\", "").replace("%", "").replace("_", "") + "%";
        Page<Conversation> result = conversations.findForUser(me.id(), pattern, Paging.of(page, size, Sort.unsorted()));
        Map<UUID, Long> unread = unreadCounts(me.id(), result.getContent().stream().map(Conversation::getId).toList());
        return PageResponse.ofMapped(result, result.getContent().stream()
                .map(c -> toDto(c, me.id(), unread.getOrDefault(c.getId(), 0L))).toList());
    }

    @Transactional(readOnly = true)
    public ConversationDto get(CurrentUser me, UUID id) {
        Conversation c = load(id, me);
        return toDto(c, me.id(), unreadCounts(me.id(), List.of(id)).getOrDefault(id, 0L));
    }

    /** The existing conversation with {@code userId} (in {@code courseId}, or the general one), else 404. */
    @Transactional(readOnly = true)
    public ConversationDto findWith(CurrentUser me, UUID userId, UUID courseId) {
        Conversation c = conversations.findByPairKey(Conversation.pairKey(courseId, me.id(), userId))
                .orElseThrow(() -> NotFoundException.of("Conversation"));
        return get(me, c.getId());
    }

    @Transactional
    public ConversationDto start(CurrentUser me, UUID recipientId, UUID courseId, String body) {
        String text = normalize(body);
        if (recipientId.equals(me.id())) {
            throw ValidationException.field("recipientId", "validation.messageSelf");
        }
        User sender = users.findById(me.id()).orElseThrow(() -> NotFoundException.of("User"));
        User recipient = users.findById(recipientId).filter(User::isEnabled)
                .orElseThrow(() -> NotFoundException.of("User"));
        Course course = null;
        if (courseId != null) {
            course = courses.findById(courseId).orElseThrow(() -> NotFoundException.of("Course"));
        }
        Instant now = Instant.now(clock);
        Conversation c = conversations.findByPairKey(Conversation.pairKey(courseId, me.id(), recipientId)).orElse(null);
        if (c == null) {
            if (!policy.canStart(sender, recipient, courseId)) {
                throw notAllowed();
            }
            c = conversations.save(new Conversation(course, sender, recipient, now));
        } else if (!policy.canReply(sender, recipient, courseId)) {
            throw notAllowed();
        }
        rateLimiter.acquire(me.id(), now);
        deliver(c, sender, recipient, text, now);
        return toDto(c, me.id(), unreadCounts(me.id(), List.of(c.getId())).getOrDefault(c.getId(), 0L));
    }

    // ---------------- messages ----------------

    @Transactional(readOnly = true)
    public MessagePageDto messages(CurrentUser me, UUID id, UUID before, Integer size) {
        Conversation c = load(id, me);
        int s = size == null || size < 1 ? DEFAULT_PAGE_SIZE : Math.min(size, Paging.MAX_SIZE);
        PageRequest page = PageRequest.of(0, s + 1);
        List<Message> list;
        if (before == null) {
            list = messages.findLatest(id, page);
        } else {
            Message cursor = messages.findById(before).filter(m -> m.getConversation().getId().equals(id))
                    .orElseThrow(() -> NotFoundException.of("Message"));
            list = messages.findBefore(id, cursor.getCreatedAt(), cursor.getId(), page);
        }
        boolean hasMore = list.size() > s;
        List<Message> items = new ArrayList<>(hasMore ? list.subList(0, s) : list);
        Collections.reverse(items);
        UUID nextCursor = hasMore && !items.isEmpty() ? items.getFirst().getId() : null;
        return new MessagePageDto(items.stream().map(m -> toDto(m, c, me.id())).toList(), hasMore, nextCursor);
    }

    @Transactional
    public MessageDto post(CurrentUser me, UUID id, String body) {
        String text = normalize(body);
        Conversation c = load(id, me);
        User sender = c.isA(me.id()) ? c.getParticipantA() : c.getParticipantB();
        User recipient = c.other(me.id());
        if (!recipient.isEnabled()
                || !policy.canReply(sender, recipient, c.getCourse() == null ? null : c.getCourse().getId())) {
            throw notAllowed();
        }
        Instant now = Instant.now(clock);
        rateLimiter.acquire(me.id(), now);
        return toDto(deliver(c, sender, recipient, text, now), c, me.id());
    }

    @Transactional
    public void markRead(CurrentUser me, UUID id) {
        Conversation c = load(id, me);
        Instant now = Instant.now(clock);
        c.markRead(me.id(), now);
        messageNotifications.markRead(me.id(), NotificationType.MESSAGE, link(id), now);
    }

    @Transactional(readOnly = true)
    public UnreadCountDto unread(CurrentUser me) {
        List<Object[]> rows = messages.unreadTotals(me.id());
        Object[] row = rows.isEmpty() ? new Object[] {0L, 0L} : rows.getFirst();
        return new UnreadCountDto(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
    }

    // ---------------- helpers ----------------

    private Message deliver(Conversation c, User sender, User recipient, String text, Instant now) {
        Message m = messages.save(new Message(c, sender, text, now));
        c.onMessage(m);
        String link = link(c.getId());
        if (!messageNotifications.existsByUserIdAndTypeAndLinkAndReadAtIsNull(recipient.getId(),
                NotificationType.MESSAGE, link)) {
            notifications.notify(recipient, NotificationType.MESSAGE, "notification.message", link, null,
                    sender.getFullName(), c.getLastMessagePreview());
        }
        return m;
    }

    private Conversation load(UUID id, CurrentUser me) {
        Conversation c = conversations.findWithParticipants(id).orElseThrow(() -> NotFoundException.of("Conversation"));
        if (!c.isParticipant(me.id())) {
            throw NotFoundException.of("Conversation");
        }
        return c;
    }

    private static String normalize(String body) {
        String text = body == null ? "" : body.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (text.isEmpty()) {
            throw ValidationException.field("body", "validation.required");
        }
        if (text.length() > MessagingDtos.MAX_BODY) {
            throw ValidationException.field("body", "validation.tooLong", MessagingDtos.MAX_BODY);
        }
        return text;
    }

    private static ForbiddenException notAllowed() {
        return new ForbiddenException("MESSAGING_NOT_ALLOWED", "You cannot message this person");
    }

    private Map<UUID, Long> unreadCounts(UUID me, List<UUID> ids) {
        Map<UUID, Long> result = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : messages.unreadByConversation(me, ids)) {
                result.put((UUID) row[0], ((Number) row[1]).longValue());
            }
        }
        return result;
    }

    private ConversationDto toDto(Conversation c, UUID me, long unread) {
        User other = c.other(me);
        Course course = c.getCourse();
        LastMessageDto last = c.getLastMessageAt() == null ? null
                : new LastMessageDto(c.getLastMessagePreview(), c.getLastMessageSenderId(),
                        me.equals(c.getLastMessageSenderId()), c.getLastMessageAt());
        return new ConversationDto(c.getId(), course == null ? null : new CourseRefDto(course.getId(), course.getTitle()),
                new ParticipantDto(other.getId(), other.getFullName(), userMapper.avatarUrl(other), other.getRole()),
                last, c.getLastMessageAt(), unread, c.getCreatedAt());
    }

    private static MessageDto toDto(Message m, Conversation c, UUID me) {
        boolean mine = m.getSender().getId().equals(me);
        Instant readMarker = c.lastReadAt(mine ? c.other(me).getId() : me);
        boolean read = readMarker != null && !readMarker.isBefore(m.getCreatedAt());
        return new MessageDto(m.getId(), c.getId(), m.getSender().getId(), mine, m.getBody(), m.getCreatedAt(), read);
    }
}
