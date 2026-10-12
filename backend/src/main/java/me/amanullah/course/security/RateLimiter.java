package me.amanullah.course.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import me.amanullah.course.config.RateLimitProperties;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * In-memory token buckets (Bucket4j) keyed by limit + client IP, e-mail or user id. Each rule {@code N/period} allows
 * a burst of N requests and refills greedily (N tokens per period). Exceeding a limit throws
 * {@link TooManyRequestsException} (429 {@code RATE_LIMITED} with {@code Retry-After}).
 *
 * <p>Limits keyed by e-mail are applied whether or not an account exists, so a 429 never reveals that an address is
 * registered. The client IP is {@link HttpServletRequest#getRemoteAddr()}: with
 * {@code server.forward-headers-strategy: framework} that is the left-most {@code X-Forwarded-For} entry, so the
 * reverse proxy must overwrite (not append to) that header (see docs/OPERATIONS.md).
 *
 * <p>Buckets are per instance. Idle buckets are evicted every few minutes.
 */
@Component
public class RateLimiter {

    /** Named limits; the rule (capacity/period) comes from {@link RateLimitProperties}. */
    public enum Limit {
        LOGIN_IP, LOGIN_EMAIL, REGISTER_IP, MAIL_EMAIL, MAIL_IP, TOKEN_IP, UPLOAD_USER, EXPORT_USER, DELETE_ACCOUNT_USER
    }

    record Rule(long capacity, Duration period) {

        static Rule parse(String spec) {
            String[] parts = spec.replace(" ", "").split("/", 2);
            return new Rule(Long.parseLong(parts[0]), DurationStyle.SIMPLE.parse(parts[1]));
        }
    }

    private record Entry(Bucket bucket, Duration period, long[] lastUsed) {
    }

    private static final int MAX_ENTRIES = 200_000;

    private final RateLimitProperties props;
    private final Map<Limit, Rule> rules;
    private final Map<String, Entry> buckets = new ConcurrentHashMap<>();

    public RateLimiter(RateLimitProperties props) {
        this.props = props;
        this.rules = Map.of(
                Limit.LOGIN_IP, Rule.parse(props.loginPerIp()),
                Limit.LOGIN_EMAIL, Rule.parse(props.loginPerEmail()),
                Limit.REGISTER_IP, Rule.parse(props.registerPerIp()),
                Limit.MAIL_EMAIL, Rule.parse(props.mailPerEmail()),
                Limit.MAIL_IP, Rule.parse(props.mailPerIp()),
                Limit.TOKEN_IP, Rule.parse(props.tokenPerIp()),
                Limit.UPLOAD_USER, Rule.parse(props.uploadPerUser()),
                Limit.EXPORT_USER, Rule.parse(props.exportPerUser()),
                Limit.DELETE_ACCOUNT_USER, Rule.parse(props.deleteAccountPerUser()));
    }

    public boolean isEnabled() {
        return props.enabled();
    }

    /** Consumes one token for {@code (limit, key)} or throws {@link TooManyRequestsException}. */
    public void consume(Limit limit, String key) {
        if (!props.enabled() || key == null) {
            return;
        }
        Rule rule = rules.get(limit);
        if (buckets.size() > MAX_ENTRIES) {
            evictIdle();
        }
        Entry entry = buckets.computeIfAbsent(limit.name() + ':' + key, k -> new Entry(Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(rule.capacity())
                        .refillGreedy(rule.capacity(), rule.period()).build())
                .build(), rule.period(), new long[1]));
        entry.lastUsed()[0] = System.nanoTime();
        ConsumptionProbe probe = entry.bucket().tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            long nanos = probe.getNanosToWaitForRefill();
            throw new TooManyRequestsException(TimeUnit.NANOSECONDS.toSeconds(nanos + 999_999_999L));
        }
    }

    public void consumeIp(Limit limit, HttpServletRequest request) {
        consume(limit, clientIp(request));
    }

    public void consumeEmail(Limit limit, String email) {
        consume(limit, email == null ? null : email.trim().toLowerCase(Locale.ROOT));
    }

    public void consumeUser(Limit limit, UUID userId) {
        consume(limit, userId == null ? null : userId.toString());
    }

    public static String clientIp(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        return ip == null || ip.isBlank() ? "unknown" : ip;
    }

    /** Forgets all buckets (tests). */
    public void reset() {
        buckets.clear();
    }

    /** Drops buckets that have been idle for longer than their period (they would be full again anyway). */
    @Scheduled(fixedDelay = 5, initialDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void evictIdle() {
        long now = System.nanoTime();
        buckets.entrySet().removeIf(e -> now - e.getValue().lastUsed()[0] > e.getValue().period().toNanos());
    }
}
