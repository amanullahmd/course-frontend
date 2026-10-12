package me.amanullah.course.announcement;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import me.amanullah.course.announcement.AnnouncementDtos.AnnouncementDto;
import me.amanullah.course.announcement.AnnouncementDtos.AnnouncementUpsert;
import me.amanullah.course.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructor: announcements")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorAnnouncementController {

    private final AnnouncementService service;

    public InstructorAnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/announcements")
    public List<AnnouncementDto> list(@PathVariable UUID courseId) {
        return service.list(CurrentUser.get(), courseId);
    }

    @PostMapping("/courses/{courseId}/announcements")
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementDto create(@PathVariable UUID courseId, @Valid @RequestBody AnnouncementUpsert request) {
        return service.create(CurrentUser.get(), courseId, request);
    }

    @GetMapping("/announcements/{id}")
    public AnnouncementDto get(@PathVariable UUID id) {
        return service.get(CurrentUser.get(), id);
    }

    @PutMapping("/announcements/{id}")
    public AnnouncementDto update(@PathVariable UUID id, @Valid @RequestBody AnnouncementUpsert request) {
        return service.update(CurrentUser.get(), id, request);
    }

    @DeleteMapping("/announcements/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    /** Sends a draft or scheduled announcement now (409 NO_RECIPIENTS when it would reach nobody). */
    @PostMapping("/announcements/{id}/send")
    public AnnouncementDto send(@PathVariable UUID id) {
        return service.send(CurrentUser.get(), id);
    }
}
