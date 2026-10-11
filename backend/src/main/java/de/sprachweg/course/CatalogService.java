package de.sprachweg.course;

import de.sprachweg.common.exception.NotFoundException;
import de.sprachweg.common.publication.Visibility;
import de.sprachweg.common.web.PageResponse;
import de.sprachweg.common.web.Paging;
import de.sprachweg.course.CourseDtos.CoursePublicDto;
import de.sprachweg.course.CourseDtos.CourseSummaryDto;
import de.sprachweg.enrollment.EnrollmentStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public catalog: only live courses with their live modules/items. */
@Service
public class CatalogService {

    private final CourseRepository courses;
    private final CourseMapper mapper;
    private final CourseStats stats;
    private final Clock clock;

    public CatalogService(CourseRepository courses, CourseMapper mapper, CourseStats stats, Clock clock) {
        this.courses = courses;
        this.mapper = mapper;
        this.stats = stats;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<CourseSummaryDto> search(String q, CefrLevel level, Integer page, Integer size) {
        Instant now = Instant.now(clock);
        String like = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Page<Course> result = courses.searchLive(like, level, now,
                Paging.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        Map<UUID, Long> students = stats.counts(result.getContent().stream().map(Course::getId).toList(),
                EnrollmentStatus.APPROVED);
        return PageResponse.of(result, c -> mapper.toSummary(c, students.getOrDefault(c.getId(), 0L), now));
    }

    @Transactional(readOnly = true)
    public CoursePublicDto getBySlug(String slug) {
        Instant now = Instant.now(clock);
        Course course = courses.findBySlug(slug)
                .filter(c -> Visibility.isLive(c, now))
                .orElseThrow(() -> NotFoundException.of("Course"));
        return mapper.toPublic(course, stats.count(course.getId(), EnrollmentStatus.APPROVED), now);
    }
}
