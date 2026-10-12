package me.amanullah.course.certificate;

import java.time.Clock;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Light fixed-window limit for the public verification endpoint: {@value #LIMIT} lookups per client address and
 * minute (in memory, per instance), enough for people and QR scans but not for enumerating codes.
 */
@Component
public class VerificationRateLimiter {

    static final int LIMIT = 60;
    private static final long WINDOW_MS = 60_000;
    private static final int MAX_CLIENTS = 10_000;

    private record Window(long start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public VerificationRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void check(String client) {
        long now = clock.millis();
        if (windows.size() > MAX_CLIENTS) {
            evict(now);
        }
        Window w = windows.compute(client == null ? "?" : client, (k, old) ->
                old == null || now - old.start() >= WINDOW_MS ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (w.count() > LIMIT) {
            throw new RateLimitedException();
        }
    }

    private void evict(long now) {
        for (Iterator<Window> it = windows.values().iterator(); it.hasNext(); ) {
            if (now - it.next().start() >= WINDOW_MS) {
                it.remove();
            }
        }
    }
}
