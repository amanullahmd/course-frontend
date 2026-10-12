package me.amanullah.course.messaging;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.user.Role;

public final class MessagingDtos {

    private MessagingDtos() {
    }

    public static final int MAX_BODY = 5000;

    /** Starts (or reuses) the conversation with {@code recipientId} in the context of {@code courseId}. */
    public record StartConversationRequest(@NotNull UUID recipientId, UUID courseId,
                                           @NotBlank @Size(max = MAX_BODY) String body) {
    }

    public record SendMessageRequest(@NotBlank @Size(max = MAX_BODY) String body) {
    }

    public record ParticipantDto(UUID id, String fullName, String avatarUrl, Role role) {
    }

    public record CourseRefDto(UUID id, String title) {
    }

    public record LastMessageDto(String preview, UUID senderId, boolean mine, Instant createdAt) {
    }

    public record ConversationDto(UUID id, CourseRefDto course, ParticipantDto other, LastMessageDto lastMessage,
                                  Instant lastMessageAt, long unreadCount, Instant createdAt) {
    }

    /**
     * {@code read}: for my own messages whether the other participant has read it, for theirs whether I have.
     */
    public record MessageDto(UUID id, UUID conversationId, UUID senderId, boolean mine, String body, Instant createdAt,
                             boolean read) {
    }

    /**
     * One page of a thread in chronological order (oldest → newest). The first request (no cursor) returns the
     * newest messages; pass {@code nextCursor} as {@code before} to load older ones while {@code hasMore}.
     */
    public record MessagePageDto(List<MessageDto> items, boolean hasMore, UUID nextCursor) {
    }

    /** {@code count}: unread messages; {@code conversations}: conversations with unread messages. */
    public record UnreadCountDto(long count, long conversations) {
    }
}
