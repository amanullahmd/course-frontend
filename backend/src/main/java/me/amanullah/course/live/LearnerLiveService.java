package me.amanullah.course.live;

import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.course.Course;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.live.LiveDtos.LearnerLiveSessionDto;
import me.amanullah.course.security.CurrentUser;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Learner view of live sessions. The join URL only appears in the join window and only for enrolled learners. */
@Service
public class LearnerLiveService {

    private static final int UPCOMING_LIMIT = 5;

    private final LearnerAccess access;
    private final LiveSessionRepository sessions;
    private final LiveAttendanceRepository attendance;
    private final EnrollmentRepository enrollments;
    private final Clock clock;

    public LearnerLiveService(LearnerAccess access, LiveSessionRepository sessions,
                              LiveAttendanceRepository attendance, EnrollmentRepository enrollments, Clock clock) {
        this.access = access;
        this.sessions = sessions;
        this.attendance = attendance;
        this.enrollments = enrollments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LearnerLiveSessionDto> forCourse(CurrentUser me, UUID courseId) {
        Instant now = Instant.now(clock);
        Course course = access.course(courseId, me, now);
        return map(me, sessions.findByCourseIdOrderByStartsAtAsc(course.getId()), now);
    }

    /** Sessions that have not ended yet (including the one running now) in the learner's live courses. */
    @Transactional(readOnly = true)
    public List<LearnerLiveSessionDto> upcoming(CurrentUser me) {
        Instant now = Instant.now(clock);
        List<UUID> courseIds = enrollments.findByStudent(me.id()).stream()
                .filter(e -> e.getStatus() == EnrollmentStatus.APPROVED && Visibility.isLive(e.getCourse(), now))
                .map(Enrollment::getCourse).map(Course::getId).toList();
        if (courseIds.isEmpty()) {
            return List.of();
        }
        List<LiveSession> next = sessions.findFrom(courseIds, now.minus(Duration.ofHours(12)), PageRequest.of(0, 60))
                .stream().filter(s -> !s.isCancelled() && s.endsAt().isAfter(now)).limit(UPCOMING_LIMIT).toList();
        return map(me, next, now);
    }

    private List<LearnerLiveSessionDto> map(CurrentUser me, List<LiveSession> list, Instant now) {
        Map<UUID, AttendanceStatus> mine = new HashMap<>();
        if (!list.isEmpty()) {
            attendance.findByStudentIdAndSessionIdIn(me.id(), list.stream().map(LiveSession::getId).toList())
                    .forEach(a -> mine.put(a.getSessionId(), a.getStatus()));
        }
        return list.stream().map(s -> new LearnerLiveSessionDto(s.getId(), s.getCourse().getId(),
                s.getCourse().getTitle(), s.getTitle(), s.getDescription(), s.getStartsAt(), s.endsAt(),
                s.getDurationMinutes(), s.isCancelled(), s.joinable(now) ? s.getJoinUrl() : null, s.joinOpensAt(),
                s.getRecordingUrl(), mine.get(s.getId()))).toList();
    }
}
