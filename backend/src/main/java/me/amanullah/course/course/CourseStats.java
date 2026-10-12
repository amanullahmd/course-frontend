package me.amanullah.course.course;

import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.course.CourseDtos.AssessmentSummaryDto;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Aggregate queries used when mapping courses, batched to avoid N+1 queries. */
@Component
public class CourseStats {

    private final EnrollmentRepository enrollments;
    private final AssessmentRepository assessments;

    public CourseStats(EnrollmentRepository enrollments, AssessmentRepository assessments) {
        this.enrollments = enrollments;
        this.assessments = assessments;
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> counts(Collection<UUID> courseIds, EnrollmentStatus status) {
        Map<UUID, Long> result = new HashMap<>();
        if (courseIds.isEmpty()) {
            return result;
        }
        for (Object[] row : enrollments.countByCourses(courseIds, status)) {
            result.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public long count(UUID courseId, EnrollmentStatus status) {
        return enrollments.countByCourseIdAndStatus(courseId, status);
    }

    @Transactional(readOnly = true)
    public Map<UUID, AssessmentSummaryDto> assessmentSummaries(Collection<UUID> itemIds) {
        Map<UUID, AssessmentSummaryDto> result = new HashMap<>();
        if (itemIds.isEmpty()) {
            return result;
        }
        for (Object[] row : assessments.summarize(itemIds)) {
            result.put((UUID) row[0], new AssessmentSummaryDto(((Number) row[1]).intValue(),
                    ((Number) row[2]).intValue(), row[3] == null ? null : ((Number) row[3]).intValue()));
        }
        return result;
    }
}
