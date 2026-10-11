package me.amanullah.course.course;

import me.amanullah.course.common.web.PageResponse;
import me.amanullah.course.course.CourseDtos.CoursePublicDto;
import me.amanullah.course.course.CourseDtos.CourseSummaryDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Public catalog")
@RestController
@RequestMapping("/api/public")
public class PublicCourseController {

    private final CatalogService catalog;

    public PublicCourseController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/courses")
    public PageResponse<CourseSummaryDto> courses(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) CefrLevel level,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return catalog.search(q, level, page, size);
    }

    @GetMapping("/courses/{slug}")
    public CoursePublicDto course(@PathVariable String slug) {
        return catalog.getBySlug(slug);
    }
}
