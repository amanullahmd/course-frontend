package me.amanullah.course.live;

import me.amanullah.course.live.LiveDtos.CalendarTokenDto;
import me.amanullah.course.live.LiveDtos.LearnerLiveSessionDto;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: live sessions")
@RestController
@RequestMapping("/api")
public class StudentLiveController {

    private final LearnerLiveService live;
    private final CalendarService calendar;

    public StudentLiveController(LearnerLiveService live, CalendarService calendar) {
        this.live = live;
        this.calendar = calendar;
    }

    /** All sessions of a course; {@code joinUrl} only from 15 minutes before the start until the end. */
    @GetMapping("/student/courses/{courseId}/live-sessions")
    public List<LearnerLiveSessionDto> forCourse(@PathVariable UUID courseId) {
        return live.forCourse(CurrentUser.get(), courseId);
    }

    /** The next sessions (not ended yet) over all of my courses. */
    @GetMapping("/student/live-sessions/upcoming")
    public List<LearnerLiveSessionDto> upcoming() {
        return live.upcoming(CurrentUser.get());
    }

    /** My iCal feed URL (created on first use). */
    @GetMapping("/users/me/calendar-token")
    public CalendarTokenDto token() {
        return calendar.token(CurrentUser.get().id());
    }

    /** New secret: the previous feed URL stops working. */
    @PostMapping("/users/me/calendar-token")
    public CalendarTokenDto rotate() {
        return calendar.rotate(CurrentUser.get().id());
    }
}
