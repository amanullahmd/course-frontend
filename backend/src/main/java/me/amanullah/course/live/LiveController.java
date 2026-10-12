package me.amanullah.course.live;

import me.amanullah.course.live.LiveDtos.AttendanceRequest;
import me.amanullah.course.live.LiveDtos.AttendanceSheetDto;
import me.amanullah.course.live.LiveDtos.LiveSessionDto;
import me.amanullah.course.live.LiveDtos.LiveSessionUpsert;
import me.amanullah.course.live.LiveDtos.SeriesRequest;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
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

@Tag(name = "Instructor: live sessions")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class LiveController {

    private final LiveSessionService service;

    public LiveController(LiveSessionService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/live-sessions")
    public List<LiveSessionDto> list(@PathVariable UUID courseId) {
        return service.list(CurrentUser.get(), courseId);
    }

    @PostMapping("/courses/{courseId}/live-sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public LiveSessionDto create(@PathVariable UUID courseId, @Valid @RequestBody LiveSessionUpsert request) {
        return service.create(CurrentUser.get(), courseId, request);
    }

    /** Weekly series in Europe/Berlin local time (daylight saving is handled). */
    @PostMapping("/courses/{courseId}/live-sessions/series")
    @ResponseStatus(HttpStatus.CREATED)
    public List<LiveSessionDto> series(@PathVariable UUID courseId, @Valid @RequestBody SeriesRequest request) {
        return service.createSeries(CurrentUser.get(), courseId, request);
    }

    /** Setting {@code cancelled=true} (or deleting) notifies the enrolled learners. */
    @PutMapping("/live-sessions/{id}")
    public LiveSessionDto update(@PathVariable UUID id, @Valid @RequestBody LiveSessionUpsert request) {
        return service.update(CurrentUser.get(), id, request);
    }

    @DeleteMapping("/live-sessions/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/live-sessions/{id}/attendance")
    public AttendanceSheetDto attendance(@PathVariable UUID id) {
        return service.sheet(CurrentUser.get(), id);
    }

    @PutMapping("/live-sessions/{id}/attendance")
    public AttendanceSheetDto saveAttendance(@PathVariable UUID id, @Valid @RequestBody AttendanceRequest request) {
        return service.saveAttendance(CurrentUser.get(), id, request);
    }
}
