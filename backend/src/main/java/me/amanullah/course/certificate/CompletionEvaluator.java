package me.amanullah.course.certificate;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.assessment.Grader;
import me.amanullah.course.certificate.CertificateDtos.CriterionDto;
import me.amanullah.course.certificate.CertificateDtos.CriterionKey;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.learning.ProgressService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checks a learner's completion criteria for a course:
 * <ul>
 *   <li><b>PROGRESS</b>: completed required live items / required live items (same rule as the course progress) ≥ the
 *       required percent;</li>
 *   <li><b>ASSESSMENTS_PASSED</b> (optional): every live quiz/exam with questions has a graded attempt whose percent
 *       reaches the assessment's passing score (essays therefore have to be graded first);</li>
 *   <li><b>AVERAGE_SCORE</b> (optional): the average of the best graded percent per quiz/exam (over those with a graded
 *       attempt) ≥ the minimum; met trivially when the course has no quizzes or exams.</li>
 * </ul>
 * The same average is the certificate's final score. Uses three flat queries, independent of the course size.
 */
@Component
public class CompletionEvaluator {

    public record Evaluation(int progressPercent, int assessmentsTotal, int assessmentsPassed, int pendingGrading,
                             Double averageScore, List<CriterionDto> criteria, boolean met) {
    }

    private final ProgressService progress;
    private final EntityManager em;

    public CompletionEvaluator(ProgressService progress, EntityManager em) {
        this.progress = progress;
        this.em = em;
    }

    @Transactional(readOnly = true)
    public Evaluation evaluate(CertificateSettings settings, UUID courseId, UUID studentId, Instant now) {
        // optional items are ignored (unless nothing is required, then everything counts)
        List<ContentItem> live = ProgressService.counted(
                progress.liveItems(List.of(courseId), now).getOrDefault(courseId, List.of()));
        List<UUID> itemIds = live.stream().map(ContentItem::getId).toList();
        Set<UUID> done = progress.completedItemIds(studentId, itemIds);
        int percent = ProgressService.percent((int) itemIds.stream().filter(done::contains).count(), itemIds.size());

        List<UUID> assessmentItemIds = live.stream().filter(i -> i.getType().isAssessment())
                .map(ContentItem::getId).toList();
        Map<UUID, Integer> passingScores = new HashMap<>();
        if (!assessmentItemIds.isEmpty()) {
            for (Object[] row : em.createQuery("""
                            select s.id, s.passingScore from Assessment s
                            where s.item.id in :itemIds and s.questions is not empty
                            """, Object[].class)
                    .setParameter("itemIds", assessmentItemIds).getResultList()) {
                passingScores.put((UUID) row[0], (Integer) row[1]);
            }
        }
        Map<UUID, Double> best = new HashMap<>();
        Map<UUID, Boolean> submitted = new HashMap<>();
        if (!passingScores.isEmpty()) {
            for (Object[] row : em.createQuery("""
                            select a.assessment.id, a.status, a.score, a.maxScore from Attempt a
                            where a.student.id = :studentId and a.assessment.id in :ids and a.status <> :inProgress
                            """, Object[].class)
                    .setParameter("studentId", studentId).setParameter("ids", passingScores.keySet())
                    .setParameter("inProgress", AttemptStatus.IN_PROGRESS).getResultList()) {
                UUID assessmentId = (UUID) row[0];
                if (row[1] == AttemptStatus.GRADED) {
                    Double pct = Grader.percent((Double) row[2], (Double) row[3]);
                    if (pct != null) {
                        best.merge(assessmentId, pct, Math::max);
                    }
                } else {
                    submitted.put(assessmentId, true);
                }
            }
        }
        int total = passingScores.size();
        int passed = 0;
        int pending = 0;
        for (Map.Entry<UUID, Integer> e : passingScores.entrySet()) {
            Double b = best.get(e.getKey());
            if (b != null && b >= e.getValue()) {
                passed++;
            } else if (submitted.containsKey(e.getKey())) {
                pending++;
            }
        }
        Double average = best.isEmpty() ? null
                : Math.round(best.values().stream().mapToDouble(Double::doubleValue).average().orElse(0) * 10) / 10.0;

        List<CriterionDto> criteria = new ArrayList<>();
        int minProgress = settings.getMinProgressPercent();
        criteria.add(new CriterionDto(CriterionKey.PROGRESS, percent >= minProgress, (double) percent,
                (double) minProgress, 0));
        if (settings.isRequireAssessmentsPassed()) {
            criteria.add(new CriterionDto(CriterionKey.ASSESSMENTS_PASSED, passed == total, (double) passed,
                    (double) total, pending));
        }
        if (settings.getMinAverageScore() != null) {
            boolean met = total == 0 || (average != null && average >= settings.getMinAverageScore());
            criteria.add(new CriterionDto(CriterionKey.AVERAGE_SCORE, met, average,
                    (double) settings.getMinAverageScore(), pending));
        }
        boolean met = criteria.stream().allMatch(CriterionDto::met);
        return new Evaluation(percent, total, passed, pending, average, List.copyOf(criteria), met);
    }
}
