package me.amanullah.course.announcement;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends SCHEDULED announcements whose {@code scheduledAt} has passed, every 60 s, each in its own transaction
 * (optimistic locking makes a concurrent "send now" win cleanly). Disabled with
 * {@code app.announcements.scheduler.enabled=false}; tests call {@link #sendDue(Instant)} directly.
 */
@Component
public class AnnouncementScheduler {

    private static final Logger log = LoggerFactory.getLogger(AnnouncementScheduler.class);
    private static final int BATCH_SIZE = 50;
    private static final int MAX_BATCHES = 20;

    private final AnnouncementRepository announcements;
    private final AnnouncementSender sender;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final boolean enabled;

    public AnnouncementScheduler(AnnouncementRepository announcements, AnnouncementSender sender,
                                 TransactionTemplate tx, Clock clock,
                                 @Value("${app.announcements.scheduler.enabled:true}") boolean enabled) {
        this.announcements = announcements;
        this.sender = sender;
        this.tx = tx;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.announcements.scheduler.interval-ms:60000}",
            initialDelayString = "${app.announcements.scheduler.initial-delay-ms:15000}")
    public void scheduledRun() {
        if (!enabled) {
            return;
        }
        try {
            int n = sendDue(Instant.now(clock));
            if (n > 0) {
                log.info("Sent {} scheduled announcement(s)", n);
            }
        } catch (RuntimeException e) {
            log.warn("Scheduled announcement run failed", e);
        }
    }

    /** Sends every announcement that is due at {@code now}; returns how many were sent. */
    public int sendDue(Instant now) {
        int sent = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<UUID> ids = announcements.findDue(now, PageRequest.of(0, BATCH_SIZE));
            if (ids.isEmpty()) {
                break;
            }
            int before = sent;
            for (UUID id : ids) {
                try {
                    Boolean done = tx.execute(s -> announcements.findWithContext(id)
                            .filter(a -> a.getStatus() == AnnouncementStatus.SCHEDULED
                                    && a.getScheduledAt() != null && !a.getScheduledAt().isAfter(now))
                            .map(a -> {
                                sender.deliver(a, now, false);
                                return true;
                            }).orElse(false));
                    if (Boolean.TRUE.equals(done)) {
                        sent++;
                    }
                } catch (RuntimeException e) {
                    log.warn("Could not send announcement {}: {}", id, e.toString());
                }
            }
            if (sent == before) {
                break; // only failures left; retried on the next run
            }
        }
        return sent;
    }
}
