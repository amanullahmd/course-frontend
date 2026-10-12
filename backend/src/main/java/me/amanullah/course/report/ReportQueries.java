package me.amanullah.course.report;

import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.assessment.Grader;
import me.amanullah.course.assessment.QuestionType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Read-only aggregate queries for the instructor reports. Every report uses a handful of flat projections (one query
 * per kind of data for the whole course or assessment) instead of walking entity graphs, so there is no N+1.
 */
@Repository
public class ReportQueries {

    @PersistenceContext
    private EntityManager em;

    /** One attempt of a course, flattened. */
    public record AttemptRow(UUID id, UUID studentId, UUID itemId, AttemptStatus status, Instant startedAt,
                             Instant submittedAt, Double score, double maxScore, boolean late, boolean autoSubmitted,
                             int passingScore) {

        public boolean submitted() {
            return status != AttemptStatus.IN_PROGRESS;
        }

        /** Percent of a submitted attempt (also partial ones awaiting manual grading). */
        public Double percent() {
            if (!submitted()) {
                return null;
            }
            return Grader.percent(score == null ? 0.0 : score, maxScore);
        }

        public Boolean passed() {
            return status == AttemptStatus.GRADED ? percent() >= passingScore : null;
        }
    }

    public record ProgressRow(UUID studentId, UUID itemId, Instant completedAt) {
    }

    /** An assessment of a course with its current total points. */
    public record AssessmentRow(UUID assessmentId, UUID itemId, int passingScore, int totalPoints) {
    }

    public record AnswerRow(UUID answerId, UUID attemptId, UUID questionId, QuestionType type, String prompt, int points,
                            int position, Boolean correct, Double pointsAwarded, String textAnswer,
                            String responseJson, boolean hasRecording) {
    }

    public record SelectionRow(UUID answerId, UUID optionId) {
    }

    public record OptionRow(UUID questionId, UUID optionId, String text, boolean correct) {
    }

    private static final String ATTEMPT_SELECT = """
            select a.id, a.student.id, i.id, a.status, a.startedAt, a.submittedAt, a.score, a.maxScore, a.late,
                   a.autoSubmitted, s.passingScore
            from Attempt a join a.assessment s join s.item i join i.module m
            """;

    public List<AttemptRow> attemptsOfCourse(UUID courseId) {
        return em.createQuery(ATTEMPT_SELECT + " where m.course.id = :courseId", Object[].class)
                .setParameter("courseId", courseId)
                .getResultList().stream().map(ReportQueries::attempt).toList();
    }

    public List<AttemptRow> attemptsOfStudent(UUID courseId, UUID studentId) {
        return em.createQuery(ATTEMPT_SELECT + " where m.course.id = :courseId and a.student.id = :studentId"
                        + " order by a.startedAt", Object[].class)
                .setParameter("courseId", courseId).setParameter("studentId", studentId)
                .getResultList().stream().map(ReportQueries::attempt).toList();
    }

    public List<AttemptRow> attemptsOfAssessment(UUID assessmentId) {
        return em.createQuery(ATTEMPT_SELECT + " where s.id = :assessmentId order by a.startedAt", Object[].class)
                .setParameter("assessmentId", assessmentId)
                .getResultList().stream().map(ReportQueries::attempt).toList();
    }

    private static AttemptRow attempt(Object[] r) {
        return new AttemptRow((UUID) r[0], (UUID) r[1], (UUID) r[2], (AttemptStatus) r[3], (Instant) r[4],
                (Instant) r[5], r[6] == null ? null : ((Number) r[6]).doubleValue(), ((Number) r[7]).doubleValue(),
                (Boolean) r[8], (Boolean) r[9], ((Number) r[10]).intValue());
    }

    public List<ProgressRow> progressOfCourse(UUID courseId) {
        return em.createQuery("""
                        select p.student.id, i.id, p.completedAt from ItemProgress p join p.item i join i.module m
                        where m.course.id = :courseId
                        """, Object[].class)
                .setParameter("courseId", courseId)
                .getResultList().stream()
                .map(r -> new ProgressRow((UUID) r[0], (UUID) r[1], (Instant) r[2])).toList();
    }

    public List<ProgressRow> progressOfStudent(UUID courseId, UUID studentId) {
        return em.createQuery("""
                        select p.student.id, i.id, p.completedAt from ItemProgress p join p.item i join i.module m
                        where m.course.id = :courseId and p.student.id = :studentId
                        """, Object[].class)
                .setParameter("courseId", courseId).setParameter("studentId", studentId)
                .getResultList().stream()
                .map(r -> new ProgressRow((UUID) r[0], (UUID) r[1], (Instant) r[2])).toList();
    }

    public List<AssessmentRow> assessmentsOfCourse(UUID courseId) {
        return em.createQuery("""
                        select s.id, i.id, s.passingScore, coalesce(sum(q.points), 0)
                        from Assessment s join s.item i join i.module m left join s.questions q
                        where m.course.id = :courseId
                        group by s.id, i.id, s.passingScore
                        """, Object[].class)
                .setParameter("courseId", courseId)
                .getResultList().stream()
                .map(r -> new AssessmentRow((UUID) r[0], (UUID) r[1], ((Number) r[2]).intValue(),
                        ((Number) r[3]).intValue()))
                .toList();
    }

    /** Answers of the submitted or graded attempts of one assessment. */
    public List<AnswerRow> answersOfAssessment(UUID assessmentId) {
        return em.createQuery("""
                        select ans.id, a.id, ans.questionId, ans.questionType, ans.prompt, ans.points, ans.position,
                               ans.correct, ans.pointsAwarded, ans.textAnswer, ans.responseJson,
                               case when ans.responseMedia is null then false else true end
                        from AttemptAnswer ans join ans.attempt a
                        where a.assessment.id = :assessmentId and a.status <> :inProgress
                        """, Object[].class)
                .setParameter("assessmentId", assessmentId).setParameter("inProgress", AttemptStatus.IN_PROGRESS)
                .getResultList().stream()
                .map(r -> new AnswerRow((UUID) r[0], (UUID) r[1], (UUID) r[2], (QuestionType) r[3], (String) r[4],
                        ((Number) r[5]).intValue(), ((Number) r[6]).intValue(), (Boolean) r[7],
                        r[8] == null ? null : ((Number) r[8]).doubleValue(), (String) r[9], (String) r[10],
                        Boolean.TRUE.equals(r[11])))
                .toList();
    }

    public List<SelectionRow> selectionsOfAssessment(UUID assessmentId) {
        return em.createQuery("""
                        select ans.id, sel from AttemptAnswer ans join ans.attempt a join ans.selectedOptionIds sel
                        where a.assessment.id = :assessmentId and a.status <> :inProgress
                        """, Object[].class)
                .setParameter("assessmentId", assessmentId).setParameter("inProgress", AttemptStatus.IN_PROGRESS)
                .getResultList().stream()
                .map(r -> new SelectionRow((UUID) r[0], (UUID) r[1])).toList();
    }

    /** Distinct option snapshots per question (texts as they were when the attempts were started). */
    public List<OptionRow> optionsOfAssessment(UUID assessmentId) {
        return em.createQuery("""
                        select distinct ans.questionId, o.optionId, o.text, o.correct
                        from AttemptAnswer ans join ans.attempt a join ans.options o
                        where a.assessment.id = :assessmentId and a.status <> :inProgress
                        """, Object[].class)
                .setParameter("assessmentId", assessmentId).setParameter("inProgress", AttemptStatus.IN_PROGRESS)
                .getResultList().stream()
                .map(r -> new OptionRow((UUID) r[0], (UUID) r[1], (String) r[2], (Boolean) r[3])).toList();
    }

    /** Points per answer of all attempts (incl. in-progress) of one assessment: {@code [attemptId, questionId, points]}. */
    public List<Object[]> pointsOfAssessment(UUID assessmentId) {
        return em.createQuery("""
                        select a.id, ans.questionId, ans.pointsAwarded from AttemptAnswer ans join ans.attempt a
                        where a.assessment.id = :assessmentId
                        """, Object[].class)
                .setParameter("assessmentId", assessmentId).getResultList();
    }

    /** Answers of one learner in one course that carry written instructor feedback. */
    public long feedbackCount(UUID courseId, UUID studentId) {
        return em.createQuery("""
                        select count(ans) from AttemptAnswer ans join ans.attempt a join a.assessment s join s.item i
                        join i.module m
                        where m.course.id = :courseId and a.student.id = :studentId and ans.feedback is not null
                        """, Long.class)
                .setParameter("courseId", courseId).setParameter("studentId", studentId)
                .getSingleResult();
    }
}
