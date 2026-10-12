package me.amanullah.course.messaging;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.notification.MailService;
import me.amanullah.course.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * E-mails "You have a new message from X" for messages that are still unread {@link #DELAY} after they arrived, at
 * most once per conversation and recipient every {@link #THROTTLE}. Reading the conversation (or replying) cancels
 * the pending e-mail. Runs every 60 s; disabled with {@code app.messaging.mail-job.enabled=false} (tests call
 * {@link #sendDue(Instant)} directly).
 */
@Component
public class MessageMailJob {

    private static final Logger log = LoggerFactory.getLogger(MessageMailJob.class);
    public static final Duration DELAY = Duration.ofMinutes(2);
    public static final Duration THROTTLE = Duration.ofMinutes(30);
    private static final int BATCH_SIZE = 100;

    private final ConversationRepository conversations;
    private final MessageEmails emails;
    private final MailService mail;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final boolean enabled;

    public MessageMailJob(ConversationRepository conversations, MessageEmails emails, MailService mail,
                          TransactionTemplate tx, Clock clock,
                          @Value("${app.messaging.mail-job.enabled:true}") boolean enabled) {
        this.conversations = conversations;
        this.emails = emails;
        this.mail = mail;
        this.tx = tx;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.messaging.mail-job.interval-ms:60000}",
            initialDelayString = "${app.messaging.mail-job.initial-delay-ms:30000}")
    @SchedulerLock(name = "MessageMailJob.sendDue", lockAtMostFor = "PT5M", lockAtLeastFor = "PT5S")
    public void scheduledRun() {
        if (!enabled) {
            return;
        }
        try {
            int n = sendDue(Instant.now(clock));
            if (n > 0) {
                log.info("Sent {} new-message e-mail(s)", n);
            }
        } catch (RuntimeException e) {
            log.warn("New-message e-mail run failed", e);
        }
    }

    /** Sends every due e-mail at {@code now}; returns how many were queued. */
    public int sendDue(Instant now) {
        Instant pendingBefore = now.minus(DELAY);
        Instant emailedBefore = now.minus(THROTTLE);
        List<UUID> ids = conversations.findMailDue(pendingBefore, emailedBefore, PageRequest.of(0, BATCH_SIZE));
        int sent = 0;
        for (UUID id : ids) {
            try {
                Integer n = tx.execute(s -> conversations.findWithParticipants(id).map(c -> {
                    int count = 0;
                    for (boolean sideA : new boolean[] {true, false}) {
                        Instant pending = c.mailPendingSince(sideA);
                        Instant last = c.lastEmailedAt(sideA);
                        if (pending == null || pending.isAfter(pendingBefore)
                                || (last != null && last.isAfter(emailedBefore))) {
                            continue;
                        }
                        User to = sideA ? c.getParticipantA() : c.getParticipantB();
                        User from = sideA ? c.getParticipantB() : c.getParticipantA();
                        if (to.isEnabled()) {
                            mail.send(to.getEmail(), emails.newMessage(to, from,
                                    c.getCourse() == null ? null : c.getCourse().getTitle(),
                                    c.getLastMessagePreview(), MessagingService.link(c.getId())));
                            count++;
                        }
                        c.markEmailed(sideA, now);
                    }
                    return count;
                }).orElse(0));
                sent += n == null ? 0 : n;
            } catch (RuntimeException e) {
                log.debug("Could not e-mail about conversation {}: {}", id, e.toString());
            }
        }
        return sent;
    }
}
