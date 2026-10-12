package me.amanullah.course.announcement;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.announcement.AnnouncementDtos.CourseUnreadDto;
import me.amanullah.course.announcement.AnnouncementDtos.LearnerAnnouncementDto;
import me.amanullah.course.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Learner: announcements")
@RestController
@RequestMapping("/api/student")
public class StudentAnnouncementController {

    private final AnnouncementService service;

    public StudentAnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/announcements")
    public List<LearnerAnnouncementDto> list(@PathVariable UUID courseId) {
        return service.forLearner(CurrentUser.get(), courseId);
    }

    @PostMapping("/announcements/{id}/read")
    public ResponseEntity<Void> read(@PathVariable UUID id) {
        service.markRead(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    /** Unread announcement counts per course (only courses with unread ones). */
    @GetMapping("/announcements/unread")
    public List<CourseUnreadDto> unread() {
        return service.unreadByCourse(CurrentUser.get());
    }
}
