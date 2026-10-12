package me.amanullah.course.certificate;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import me.amanullah.course.assessment.Attempt;
import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.learning.ItemProgress;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Re-checks the certificate criteria when learning progress changes, without coupling the learning and assessment
 * code to certificates: Hibernate listeners notice a completed item ({@link ItemProgress} inserted, also when a
 * quiz/exam is submitted) and a graded attempt ({@link Attempt} updated to {@code GRADED}, by auto-grading, manual
 * grading or the expiry sweeper). The affected (learner, course) pairs are collected per transaction and evaluated
 * <em>after commit</em> in a new transaction, so a failure here never affects the original request.
 */
@Component
public class CertificateTriggers implements PostInsertEventListener, PostUpdateEventListener {

    private static final Logger log = LoggerFactory.getLogger(CertificateTriggers.class);

    /** Either an item id or an assessment id, plus the learner. */
    record Change(UUID itemId, UUID assessmentId, UUID studentId) {
    }

    private final EntityManagerFactory emf;
    private final EntityManager em;
    private final CertificateService certificates;
    private final TransactionTemplate readTx;

    public CertificateTriggers(EntityManagerFactory emf, EntityManager em, CertificateService certificates,
                               PlatformTransactionManager txManager) {
        this.emf = emf;
        this.em = em;
        this.certificates = certificates;
        this.readTx = new TransactionTemplate(txManager);
        this.readTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.readTx.setReadOnly(true);
    }

    @PostConstruct
    void register() {
        EventListenerRegistry registry = emf.unwrap(SessionFactoryImplementor.class).getServiceRegistry()
                .requireService(EventListenerRegistry.class);
        registry.appendListeners(EventType.POST_INSERT, this);
        registry.appendListeners(EventType.POST_UPDATE, this);
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        if (event.getEntity() instanceof ItemProgress p) {
            schedule(new Change(p.getItem().getId(), null, p.getStudent().getId()));
        }
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        if (event.getEntity() instanceof Attempt a && a.getStatus() == AttemptStatus.GRADED) {
            schedule(new Change(null, a.getAssessment().getId(), a.getStudent().getId()));
        }
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private void schedule(Change change) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) {
            if (s instanceof AfterCommit pending) {
                pending.changes.add(change);
                return;
            }
        }
        AfterCommit pending = new AfterCommit();
        pending.changes.add(change);
        TransactionSynchronizationManager.registerSynchronization(pending);
    }

    private final class AfterCommit implements TransactionSynchronization {

        private final Set<Change> changes = new LinkedHashSet<>();

        @Override
        public void afterCommit() {
            try {
                Set<List<UUID>> pairs = new LinkedHashSet<>();
                readTx.executeWithoutResult(status -> {
                    for (Change c : changes) {
                        UUID courseId = courseOf(c);
                        if (courseId != null) {
                            pairs.add(List.of(courseId, c.studentId()));
                        }
                    }
                });
                pairs.forEach(p -> certificates.autoIssue(p.get(0), p.get(1)));
            } catch (RuntimeException e) {
                log.warn("Certificate check after commit failed: {}", e.toString(), e);
            }
        }
    }

    private UUID courseOf(Change c) {
        List<UUID> ids = c.itemId() != null
                ? em.createQuery("select i.module.course.id from ContentItem i where i.id = :id", UUID.class)
                .setParameter("id", c.itemId()).getResultList()
                : em.createQuery("select s.item.module.course.id from Assessment s where s.id = :id", UUID.class)
                .setParameter("id", c.assessmentId()).getResultList();
        return ids.isEmpty() ? null : ids.getFirst();
    }
}
