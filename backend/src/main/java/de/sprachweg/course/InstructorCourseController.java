package de.sprachweg.course;

import de.sprachweg.common.publication.PublicationRequest;
import de.sprachweg.common.web.IdsRequest;
import de.sprachweg.course.CourseDtos.ContentItemDto;
import de.sprachweg.course.CourseDtos.CourseDto;
import de.sprachweg.course.CourseDtos.CourseUpsert;
import de.sprachweg.course.CourseDtos.InstructorCourseDto;
import de.sprachweg.course.CourseDtos.ItemUpsert;
import de.sprachweg.course.CourseDtos.ModuleDto;
import de.sprachweg.course.CourseDtos.ModuleUpsert;
import de.sprachweg.security.CurrentUser;
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

@Tag(name = "Instructor: course builder")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorCourseController {

    private final CourseService courseService;
    private final ContentService contentService;

    public InstructorCourseController(CourseService courseService, ContentService contentService) {
        this.courseService = courseService;
        this.contentService = contentService;
    }

    // ----- courses -----

    @GetMapping("/courses")
    public List<InstructorCourseDto> courses() {
        return courseService.list(CurrentUser.get());
    }

    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto create(@Valid @RequestBody CourseUpsert request) {
        return courseService.create(CurrentUser.get(), request);
    }

    @GetMapping("/courses/{id}")
    public CourseDto get(@PathVariable UUID id) {
        return courseService.get(CurrentUser.get(), id);
    }

    @PutMapping("/courses/{id}")
    public CourseDto update(@PathVariable UUID id, @Valid @RequestBody CourseUpsert request) {
        return courseService.update(CurrentUser.get(), id, request);
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        courseService.delete(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/courses/{id}/publication")
    public CourseDto publish(@PathVariable UUID id, @Valid @RequestBody PublicationRequest request) {
        return courseService.publish(CurrentUser.get(), id, request);
    }

    // ----- modules -----

    @PostMapping("/courses/{id}/modules")
    @ResponseStatus(HttpStatus.CREATED)
    public ModuleDto createModule(@PathVariable UUID id, @Valid @RequestBody ModuleUpsert request) {
        return contentService.createModule(CurrentUser.get(), id, request);
    }

    @PutMapping("/courses/{id}/modules/order")
    public ResponseEntity<Void> reorderModules(@PathVariable UUID id, @Valid @RequestBody IdsRequest request) {
        courseService.reorderModules(CurrentUser.get(), id, request.ids());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/modules/{id}")
    public ModuleDto updateModule(@PathVariable UUID id, @Valid @RequestBody ModuleUpsert request) {
        return contentService.updateModule(CurrentUser.get(), id, request);
    }

    @DeleteMapping("/modules/{id}")
    public ResponseEntity<Void> deleteModule(@PathVariable UUID id) {
        contentService.deleteModule(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/modules/{id}/publication")
    public ModuleDto publishModule(@PathVariable UUID id, @Valid @RequestBody PublicationRequest request) {
        return contentService.publishModule(CurrentUser.get(), id, request);
    }

    // ----- items -----

    @PostMapping("/modules/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ContentItemDto createItem(@PathVariable UUID id, @Valid @RequestBody ItemUpsert request) {
        return contentService.createItem(CurrentUser.get(), id, request);
    }

    @PutMapping("/modules/{id}/items/order")
    public ResponseEntity<Void> reorderItems(@PathVariable UUID id, @Valid @RequestBody IdsRequest request) {
        contentService.reorderItems(CurrentUser.get(), id, request.ids());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/items/{id}")
    public ContentItemDto getItem(@PathVariable UUID id) {
        return contentService.getItem(CurrentUser.get(), id);
    }

    @PutMapping("/items/{id}")
    public ContentItemDto updateItem(@PathVariable UUID id, @Valid @RequestBody ItemUpsert request) {
        return contentService.updateItem(CurrentUser.get(), id, request);
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        contentService.deleteItem(CurrentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{id}/publication")
    public ContentItemDto publishItem(@PathVariable UUID id, @Valid @RequestBody PublicationRequest request) {
        return contentService.publishItem(CurrentUser.get(), id, request);
    }
}
