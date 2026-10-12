package me.amanullah.course.report;

import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.assessment.QuestionType;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.user.UserSummaryDto;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Read models of the instructor reports ({@code /api/instructor/.../reports/...}). Percentages are 0–100. */
public final class ReportDtos {

    private ReportDtos() {
    }

    public record CourseRef(UUID id, String slug, String title) {
    }

    // ------------------------------------------------------------------ overview

    public record OverviewDto(CourseRef course, Instant generatedAt, Kpis kpis, List<Bucket> progressDistribution,
                              List<ModuleCompletion> modules, Funnel funnel, List<WeekBucket> enrollmentTimeline,
                              List<ItemEngagement> items) {
    }

    /**
     * Applications and approvals per ISO week (Monday, UTC), last 12 weeks or since the course was created.
     * Re-applications reuse the enrollment row, so only the latest application of a learner is counted.
     */
    public record WeekBucket(LocalDate weekStart, int applications, int approvals) {
    }

    /**
     * Engagement of one live item among the approved learners (content funnel). The assessment fields are only set
     * for quizzes and exams: {@code taken} = learners with a submitted attempt, {@code passed} and
     * {@code averagePercent} use their best graded attempt.
     */
    public record ItemEngagement(UUID itemId, String title, ItemType type, UUID moduleId, String moduleTitle,
                                 int completed, Double completedPercent, Integer taken, Double takenPercent,
                                 Integer passed, Double averagePercent) {
    }

    /**
     * @param averageProgress    mean progress of approved learners (null without learners)
     * @param completionRate     share of approved learners with 100 % progress (null without learners)
     * @param averageBestScore   mean of every learner's best graded percent per assessment (null without results)
     * @param passRate           share of those best results that reach the passing score (null without results)
     * @param pendingGrading     submitted attempts that still need manual grading
     * @param activeLearners7d   approved learners with progress or attempt activity in the last 7 days
     */
    public record Kpis(int approvedLearners, int pendingApplications, Double averageProgress, Double medianProgress,
                       Double completionRate, int completedLearners, int assessments, Double averageBestScore, Double passRate,
                       int pendingGrading, int activeLearners7d, int totalLiveItems) {
    }

    /** Histogram bucket {@code [from, to)}; the last progress bucket is exactly 100. */
    public record Bucket(String label, int from, int to, int count) {
    }

    public record ModuleCompletion(UUID moduleId, String title, int itemCount, Double completionPercent) {
    }

    /**
     * Current status counts of all applications. {@code approvalRate} = (approved + revoked) / (approved + revoked +
     * rejected), i.e. the share of decided applications that were accepted (null before any decision).
     */
    public record Funnel(int applied, int pending, int approved, int rejected, int withdrawn, int revoked,
                         Double approvalRate) {
    }

    // ------------------------------------------------------------------ gradebook

    public record GradebookDto(CourseRef course, Instant generatedAt, int totalLiveItems,
                               List<GradebookColumn> columns, List<GradebookRow> rows) {
    }

    public record GradebookColumn(UUID itemId, String title, ItemType type, int maxScore, int passingScore,
                                  ColumnStats stats) {
    }

    /** Statistics over the learners' best graded results of one assessment. */
    public record ColumnStats(int graded, Double average, Double median, Double min, Double max, Double passRate,
                              int attempts, int pendingGrading) {
    }

    /**
     * One approved learner. Lessons are the live non-assessment items; a quiz/exam counts as taken with at least one
     * submitted attempt. {@code activity}: COMPLETED at 100 %, INACTIVE without activity for 14+ days, NOT_STARTED
     * without any activity, else IN_PROGRESS.
     */
    public record GradebookRow(UUID id, String fullName, String email, String avatarUrl, Instant enrolledAt,
                               int progressPercent, int completedItems, int totalLiveItems, int lessonsCompleted,
                               int lessonsTotal, int quizzesTaken, int quizzesTotal, int examsTaken, int examsTotal,
                               Double averageQuizPercent, Double averageExamPercent, Instant lastActivityAt,
                               ActivityStatus activity, Double averagePercent, int gradedAssessments,
                               List<GradebookCell> cells) {
    }

    public enum ActivityStatus { NOT_STARTED, IN_PROGRESS, COMPLETED, INACTIVE }

    public enum CellStatus { NOT_STARTED, IN_PROGRESS, SUBMITTED_PENDING, GRADED }

    /**
     * @param bestPercent    best percent of the graded attempts
     * @param passed         whether {@code bestPercent} reaches the passing score (null when nothing is graded)
     * @param latestAttemptId the attempt to open: the one awaiting grading, else the latest submitted, else the latest
     */
    public record GradebookCell(UUID itemId, Double bestPercent, Double bestScore, int attempts, Boolean passed,
                                CellStatus status, UUID latestAttemptId, Instant lastSubmittedAt) {
    }

    // ------------------------------------------------------------------ learner report

    public record StudentReportDto(CourseRef course, Instant generatedAt, UserSummaryDto student,
                                   StudentEnrollment enrollment, int progressPercent, int completedItems,
                                   int totalLiveItems, Instant lastActivityAt, List<ModuleProgress> modules,
                                   List<StudentAttempt> attempts, StudentTotals totals, int feedbackCount) {
    }

    public record StudentEnrollment(UUID id, EnrollmentStatus status, Instant appliedAt, Instant decidedAt) {
    }

    public record ModuleProgress(UUID moduleId, String title, int completedItems, int totalItems,
                                 int progressPercent, List<ItemProgressRow> items) {
    }

    public record ItemProgressRow(UUID itemId, String title, ItemType type, Instant completedAt) {
    }

    public record StudentAttempt(UUID id, UUID itemId, String itemTitle, ItemType itemType, AttemptStatus status,
                                 Instant startedAt, Instant submittedAt, Double score, double maxScore, Double percent,
                                 Boolean passed, boolean late, boolean autoSubmitted, boolean pendingManualGrading) {
    }

    /**
     * @param averageBestPercent mean of the best graded percent per assessment the learner attempted
     */
    public record StudentTotals(int attempts, int assessmentsAttempted, int assessmentsPassed, int assessments,
                                Double averageBestPercent, int pendingGrading) {
    }

    // ------------------------------------------------------------------ assessment analytics

    /**
     * Statistics of the submitted and graded attempts of one quiz/exam. Score figures use graded attempts only;
     * {@code pendingGrading} counts submitted attempts that still need manual grading.
     */
    public record AssessmentAnalyticsDto(UUID itemId, String title, ItemType type, CourseRef course, Instant generatedAt,
                                         int maxScore, int passingScore, int attempts, int uniqueLearners,
                                         int gradedAttempts, int pendingGrading, int inProgress,
                                         Double averagePercent, Double medianPercent, Double averageScore,
                                         Double passRate, Double averageDurationSeconds,
                                         List<Bucket> scoreDistribution, List<QuestionStats> questions) {
    }

    /**
     * @param percentCorrect share of the evaluated answers that are fully correct (null when none are evaluated yet)
     * @param commonWrongAnswers most frequent wrong choices (choice questions) or wrong texts (text questions), top 3
     */
    public record QuestionStats(UUID questionId, int position, String prompt, QuestionType type, int points,
                                int answered, int unanswered, Double percentCorrect, Double averagePoints,
                                List<WrongAnswer> commonWrongAnswers) {
    }

    public record WrongAnswer(String text, int count) {
    }
}
