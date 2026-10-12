package me.amanullah.course.course;

import me.amanullah.course.common.publication.PublicationRequest;
import me.amanullah.course.common.web.IdsRequest;
import me.amanullah.course.course.CourseDtos.CloneRequest;
import me.amanullah.course.course.CourseDtos.ContentItemDto;
import me.amanullah.course.course.CourseDtos.DuplicateItemRequest;
import me.amanullah.course.course.CourseDtos.ReleaseRulesRequest;
import me.amanullah.course.course.CourseDtos.CourseDto;
import me.amanullah.course.course.CourseDtos.CourseUpsert;
import me.amanullah.course.course.CourseDtos.InstructorCourseDto;
import me.amanullah.course.course.CourseDtos.ItemUpsert;
import me.amanullah.course.course.CourseDtos.ModuleDto;
import me.amanullah.course.course.CourseDtos.ModuleUpsert;
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

@Tag(name = "Instructor: course builder")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorCourseController {

    private final CourseService courseService;
    private final ContentService contentService;
    private final ReleaseRulesService releaseRules;
    private final CourseCloner cloner;

    public InstructorCourseController(CourseService courseService, ContentService contentService,
                                      ReleaseRulesService releaseRules, CourseCloner cloner) {
        this.courseService = courseService;
        this.contentService = contentService;
        this.releaseRules = releaseRules;
        this.cloner = cloner;
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

    @PostMapping("/courses/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto cloneCourse(@PathVariable UUID id, @Valid @RequestBody CloneRequest request) {
        return cloner.cloneCourse(CurrentUser.get(), id, request);
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

    @PostMapping("/modules/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ModuleDto duplicateModule(@PathVariable UUID id) {
        return cloner.duplicateModule(CurrentUser.get(), id);
    }

    @PutMapping("/modules/{id}/release")
    public ModuleDto moduleRelease(@PathVariable UUID id, @Valid @RequestBody ReleaseRulesRequest request) {
        return releaseRules.updateModule(CurrentUser.get(), id, request);
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

    @PostMapping("/items/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ContentItemDto duplicateItem(@PathVariable UUID id,
                                        @Valid @RequestBody(required = false) DuplicateItemRequest request) {
        return cloner.duplicateItem(CurrentUser.get(), id, request == null ? null : request.targetModuleId());
    }

    @PutMapping("/items/{id}/release")
    public ContentItemDto itemRelease(@PathVariable UUID id, @Valid @RequestBody ReleaseRulesRequest request) {
        return releaseRules.updateItem(CurrentUser.get(), id, request);
    }
}
