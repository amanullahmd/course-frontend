package me.amanullah.course.assessment;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Periodically submits abandoned attempts whose deadline (or assessment window) has passed, using the answers that
 * were autosaved so far. Each attempt is finalized in its own transaction; optimistic locking makes a concurrent
 * submit by the learner win cleanly. Disabled with {@code app.attempts.sweeper.enabled=false} (tests call
 * {@link #sweep(Instant)} directly).
 */
@Component
public class AttemptExpirySweeper {

    private static final Logger log = LoggerFactory.getLogger(AttemptExpirySweeper.class);
    static final int BATCH_SIZE = 100;
    private static final int MAX_BATCHES = 50;

    private final AttemptRepository attempts;
    private final AttemptFinalizer finalizer;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final boolean enabled;

    public AttemptExpirySweeper(AttemptRepository attempts, AttemptFinalizer finalizer, TransactionTemplate tx,
                                Clock clock, @Value("${app.attempts.sweeper.enabled:true}") boolean enabled) {
        this.attempts = attempts;
        this.finalizer = finalizer;
        this.tx = tx;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.attempts.sweeper.interval-ms:60000}",
            initialDelayString = "${app.attempts.sweeper.initial-delay-ms:20000}")
    @SchedulerLock(name = "AttemptExpirySweeper.sweep", lockAtMostFor = "PT5M", lockAtLeastFor = "PT5S")
    public void scheduledSweep() {
        if (!enabled) {
            return;
        }
        try {
            int n = sweep(Instant.now(clock));
            if (n > 0) {
                log.info("Auto-submitted {} expired attempt(s)", n);
            }
        } catch (RuntimeException e) {
            log.warn("Attempt expiry sweep failed", e);
        }
    }

    /** Finalizes every attempt that has expired at {@code now}; returns how many were submitted. */
    public int sweep(Instant now) {
        Instant cutoff = now.minus(AttemptFinalizer.GRACE);
        Set<UUID> skipped = new HashSet<>();
        int finalized = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            // skipped attempts stay IN_PROGRESS, so look past them
            PageRequest page = PageRequest.of(0, BATCH_SIZE + skipped.size());
            Set<UUID> ids = new LinkedHashSet<>(attempts.findExpiredByDeadline(cutoff, page));
            ids.addAll(attempts.findExpiredByWindow(cutoff, page));
            ids.removeAll(skipped);
            if (ids.isEmpty()) {
                break;
            }
            for (UUID id : ids) {
                try {
                    Boolean done = tx.execute(s -> attempts.findWithContext(id)
                            .map(a -> finalizer.finalizeIfExpired(a, now)).orElse(false));
                    if (Boolean.TRUE.equals(done)) {
                        finalized++;
                    } else {
                        skipped.add(id);
                    }
                } catch (RuntimeException e) {
                    // e.g. the learner submitted at the same moment (optimistic lock); retried on the next run
                    log.debug("Could not finalize attempt {}: {}", id, e.toString());
                    skipped.add(id);
                }
            }
        }
        return finalized;
    }
}
