package me.amanullah.course.course;

import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.publication.PublicationRequest;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.common.util.SlugGenerator;
import me.amanullah.course.course.CourseDtos.CourseDto;
import me.amanullah.course.course.CourseDtos.CourseUpsert;
import me.amanullah.course.course.CourseDtos.InstructorCourseDto;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CourseService {

    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final UserRepository users;
    private final CourseAccess access;
    private final CourseMapper mapper;
    private final CourseStats stats;
    private final MediaService mediaService;
    private final Clock clock;

    public CourseService(CourseRepository courses, CourseModuleRepository modules, UserRepository users,
                         CourseAccess access, CourseMapper mapper, CourseStats stats, MediaService mediaService,
                         Clock clock) {
        this.courses = courses;
        this.modules = modules;
        this.users = users;
        this.access = access;
        this.mapper = mapper;
        this.stats = stats;
        this.mediaService = mediaService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<InstructorCourseDto> list(CurrentUser me) {
        List<Course> list = me.isAdmin() ? courses.findAllByOrderByUpdatedAtDesc()
                : courses.findByInstructorIdOrderByUpdatedAtDesc(me.id());
        List<UUID> ids = list.stream().map(Course::getId).toList();
        Map<UUID, Long> approved = stats.counts(ids, EnrollmentStatus.APPROVED);
        Map<UUID, Long> pending = stats.counts(ids, EnrollmentStatus.PENDING);
        Instant now = Instant.now(clock);
        return list.stream().map(c -> mapper.toInstructorDto(c, approved.getOrDefault(c.getId(), 0L),
                pending.getOrDefault(c.getId(), 0L), now)).toList();
    }

    @Transactional
    public CourseDto create(CurrentUser me, CourseUpsert req) {
        User instructor = users.getReferenceById(me.id());
        Course course = new Course(instructor, SlugGenerator.unique(req.title(), courses::existsBySlug));
        apply(course, req, me);
        courses.save(course);
        return toDto(course);
    }

    @Transactional(readOnly = true)
    public CourseDto get(CurrentUser me, UUID id) {
        return toDto(access.course(id, me));
    }

    @Transactional
    public CourseDto update(CurrentUser me, UUID id, CourseUpsert req) {
        Course course = access.course(id, me);
        apply(course, req, me);
        return toDto(course);
    }

    @Transactional
    public void delete(CurrentUser me, UUID id) {
        Course course = access.course(id, me);
        courses.deleteCourseById(course.getId());
    }

    @Transactional
    public CourseDto publish(CurrentUser me, UUID id, PublicationRequest req) {
        Course course = access.course(id, me);
        req.applyTo(course);
        course.touch();
        return toDto(course);
    }

    @Transactional
    public void reorderModules(CurrentUser me, UUID courseId, List<UUID> ids) {
        Course course = access.course(courseId, me);
        List<CourseModule> current = modules.findByCourseIdOrderByPositionAsc(course.getId());
        Set<UUID> currentIds = new HashSet<>(current.stream().map(CourseModule::getId).toList());
        if (ids.size() != current.size() || !currentIds.equals(new HashSet<>(ids))) {
            throw new ValidationException("ids must contain exactly the course's module ids",
                    Map.of("ids", "must contain exactly the course's module ids"));
        }
        Map<UUID, CourseModule> byId = new java.util.HashMap<>();
        current.forEach(m -> byId.put(m.getId(), m));
        for (int i = 0; i < ids.size(); i++) {
            byId.get(ids.get(i)).setPosition(i);
        }
        course.touch();
    }

    /** Maps the full tree incl. drafts (instructor view). */
    @Transactional(readOnly = true)
    public CourseDto toDto(Course course) {
        List<UUID> itemIds = course.getModules().stream()
                .flatMap(m -> m.getItems().stream()).map(ContentItem::getId).toList();
        return mapper.toCourseDto(course, stats.count(course.getId(), EnrollmentStatus.APPROVED),
                stats.count(course.getId(), EnrollmentStatus.PENDING), stats.assessmentSummaries(itemIds),
                Instant.now(clock));
    }

    private void apply(Course course, CourseUpsert req, CurrentUser me) {
        course.setTitle(req.title().trim());
        course.setSubtitle(blankToNull(req.subtitle()));
        course.setDescription(HtmlSanitizer.sanitize(req.description()));
        course.setLevel(req.level());
        course.setEnrollmentMode(req.enrollmentMode());
        course.setCapacity(req.capacity());
        course.setTags(normalizeTags(req.tags()));
        if (req.coverImageId() == null) {
            course.setCoverImage(null);
        } else if (course.getCoverImage() == null || !Objects.equals(course.getCoverImage().getId(), req.coverImageId())) {
            MediaAsset cover = mediaService.requireUsable(req.coverImageId(), me.id(), me.isAdmin());
            if (cover.getKind() != MediaKind.IMAGE) {
                throw new ValidationException("The cover must be an image", Map.of("coverImageId", "must be an image"));
            }
            course.setCoverImage(cover);
        }
    }

    static List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String t : tags) {
            if (t != null && !t.isBlank()) {
                seen.add(t.trim());
            }
        }
        return List.copyOf(seen);
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
