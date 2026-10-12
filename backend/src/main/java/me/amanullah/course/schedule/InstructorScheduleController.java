package me.amanullah.course.schedule;

import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructor: schedule & dashboard")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorScheduleController {

    private final ScheduleService scheduleService;
    private final DashboardService dashboardService;

    public InstructorScheduleController(ScheduleService scheduleService, DashboardService dashboardService) {
        this.scheduleService = scheduleService;
        this.dashboardService = dashboardService;
    }

    @GetMapping("/schedule")
    public List<ScheduleEventDto> schedule(@RequestParam(required = false) Instant from,
                                           @RequestParam(required = false) Instant to,
                                           @RequestParam(required = false) UUID courseId) {
        return scheduleService.events(CurrentUser.get(), from, to, courseId);
    }

    @GetMapping("/dashboard")
    public DashboardService.DashboardDto dashboard() {
        return dashboardService.dashboard(CurrentUser.get());
    }
}
