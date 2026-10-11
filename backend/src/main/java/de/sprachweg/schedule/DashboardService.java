package de.sprachweg.schedule;

import de.sprachweg.course.CourseRepository;
import de.sprachweg.enrollment.EnrollmentDtos.EnrollmentDto;
import de.sprachweg.enrollment.EnrollmentRepository;
import de.sprachweg.enrollment.EnrollmentService;
import de.sprachweg.enrollment.EnrollmentStatus;
import de.sprachweg.security.CurrentUser;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    /**
     * {@code upcoming}: schedule events of the next 30 days (max 10);
     * {@code recentApplications}: the 5 most recent PENDING applications.
     */
    public record DashboardDto(long courseCount, long liveCourseCount, long studentCount, long pendingCount,
                               List<ScheduleEventDto> upcoming, List<EnrollmentDto> recentApplications) {
    }

    private final CourseRepository courses;
    private final EnrollmentRepository enrollments;
    private final EnrollmentService enrollmentService;
    private final ScheduleService scheduleService;
    private final Clock clock;

    public DashboardService(CourseRepository courses, EnrollmentRepository enrollments,
                            EnrollmentService enrollmentService, ScheduleService scheduleService, Clock clock) {
        this.courses = courses;
        this.enrollments = enrollments;
        this.enrollmentService = enrollmentService;
        this.scheduleService = scheduleService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardDto dashboard(CurrentUser me) {
        Instant now = Instant.now(clock);
        UUID owner = me.isAdmin() ? null : me.id();
        long courseCount = owner == null ? courses.count() : courses.countByInstructorId(owner);
        long live = owner == null ? courses.countLive(now) : courses.countLiveByInstructor(owner, now);
        List<ScheduleEventDto> upcoming = scheduleService.events(me, now, now.plus(Duration.ofDays(30)), null)
                .stream().limit(10).toList();
        return new DashboardDto(courseCount, live,
                enrollments.countDistinctStudents(owner, EnrollmentStatus.APPROVED),
                enrollments.countForInstructor(owner, EnrollmentStatus.PENDING),
                upcoming, enrollmentService.recentPending(owner, 5));
    }
}
