package me.amanullah.course.messaging;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Sliding-window limit of {@value #LIMIT} messages per user and minute, kept in memory (per instance; good enough for
 * a single backend node, a shared store would be needed when scaling out).
 */
@Component
public class MessageRateLimiter {

    public static final int LIMIT = 30;
    static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Map<UUID, Deque<Instant>> windows = new ConcurrentHashMap<>();

    /** Records one message for {@code userId} or throws {@link RateLimitedException} (nothing recorded). */
    public void acquire(UUID userId, Instant now) {
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    Instant last = e.getValue().peekLast();
                    return last == null || !last.isAfter(now.minus(WINDOW));
                }
            });
        }
        Deque<Instant> window = windows.computeIfAbsent(userId, id -> new ArrayDeque<>());
        synchronized (window) {
            Instant cutoff = now.minus(WINDOW);
            while (!window.isEmpty() && !window.peekFirst().isAfter(cutoff)) {
                window.pollFirst();
            }
            if (window.size() >= LIMIT) {
                long wait = Duration.between(now, window.peekFirst().plus(WINDOW)).toMillis();
                throw new RateLimitedException(Math.max(1, (wait + 999) / 1000));
            }
            window.addLast(now);
        }
    }
}
