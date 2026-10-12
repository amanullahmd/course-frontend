package me.amanullah.course.course;

import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.course.CourseDtos.AssessmentSummaryDto;
import me.amanullah.course.course.CourseDtos.ContentItemDto;
import me.amanullah.course.course.CourseDtos.CourseDetailDto;
import me.amanullah.course.course.CourseDtos.CourseDto;
import me.amanullah.course.course.CourseDtos.CoursePublicDto;
import me.amanullah.course.course.CourseDtos.CourseSummaryDto;
import me.amanullah.course.course.CourseDtos.InstructorCourseDto;
import me.amanullah.course.course.CourseDtos.InstructorProfile;
import me.amanullah.course.course.CourseDtos.InstructorRef;
import me.amanullah.course.course.CourseDtos.ModuleDto;
import me.amanullah.course.course.CourseDtos.OutlineItem;
import me.amanullah.course.course.CourseDtos.OutlineModule;
import me.amanullah.course.course.CourseDtos.PrerequisiteDto;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.media.MediaUrlSigner;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserMapper;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class CourseMapper {

    private final MediaMapper mediaMapper;
    private final UserMapper userMapper;
    private final MediaUrlSigner signer;
    private final ReleasePrerequisiteRepository prerequisites;
    private final ContentItemRepository itemRepository;

    public CourseMapper(MediaMapper mediaMapper, UserMapper userMapper, MediaUrlSigner signer,
                        ReleasePrerequisiteRepository prerequisites, ContentItemRepository itemRepository) {
        this.mediaMapper = mediaMapper;
        this.userMapper = userMapper;
        this.signer = signer;
        this.prerequisites = prerequisites;
        this.itemRepository = itemRepository;
    }

    /** Prerequisites of a course keyed by their target (module or item id), with the required items' titles. */
    public Map<UUID, List<PrerequisiteDto>> prerequisiteIndex(UUID courseId) {
        List<ReleasePrerequisite> rows = prerequisites.findByCourse(courseId);
        Map<UUID, List<PrerequisiteDto>> result = new HashMap<>();
        if (rows.isEmpty()) {
            return result;
        }
        Map<UUID, ContentItem> required = new HashMap<>();
        itemRepository.findAllById(rows.stream().map(ReleasePrerequisite::getRequiresItemId).distinct().toList())
                .forEach(i -> required.put(i.getId(), i));
        for (ReleasePrerequisite p : rows) {
            ContentItem i = required.get(p.getRequiresItemId());
            if (i != null) {
                result.computeIfAbsent(p.getTargetId(), k -> new java.util.ArrayList<>())
                        .add(new PrerequisiteDto(i.getId(), i.getTitle(), i.getType(), p.getMinPercent()));
            }
        }
        result.values().forEach(l -> l.sort(java.util.Comparator.comparing(PrerequisiteDto::title)
                .thenComparing(PrerequisiteDto::itemId)));
        return result;
    }

    /** Rich text with embedded media URLs re-signed. */
    public String html(String html) {
        return signer.refreshEmbeddedUrls(html);
    }

    // ---------- learner-facing (live content only) ----------

    public List<CourseModule> liveModules(Course c, Instant now) {
        return c.getModules().stream().filter(m -> Visibility.isLive(m, now)).toList();
    }

    public List<ContentItem> liveItems(CourseModule m, Instant now) {
        return m.getItems().stream().filter(i -> Visibility.isLive(i, now)).toList();
    }

    private int liveItemCount(Course c, Instant now) {
        return liveModules(c, now).stream().mapToInt(m -> liveItems(m, now).size()).sum();
    }

    public InstructorRef instructorRef(User u) {
        return new InstructorRef(u.getId(), u.getFullName(), userMapper.avatarUrl(u));
    }

    public CourseSummaryDto toSummary(Course c, long studentCount, Instant now) {
        return new CourseSummaryDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getLevel(),
                List.copyOf(c.getTags()), mediaMapper.url(c.getCoverImage()), instructorRef(c.getInstructor()),
                studentCount, liveModules(c, now).size(), liveItemCount(c, now), c.getEnrollmentMode(),
                c.effectivePublishedAt());
    }

    public CourseDetailDto toDetail(Course c, long studentCount, Instant now) {
        return new CourseDetailDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getLevel(),
                List.copyOf(c.getTags()), mediaMapper.url(c.getCoverImage()), instructorRef(c.getInstructor()),
                studentCount, liveModules(c, now).size(), liveItemCount(c, now), c.getEnrollmentMode(),
                c.effectivePublishedAt(), html(c.getDescription()));
    }

    public CoursePublicDto toPublic(Course c, long studentCount, Instant now) {
        User u = c.getInstructor();
        List<OutlineModule> outline = liveModules(c, now).stream()
                .map(m -> new OutlineModule(m.getId(), m.getTitle(), m.getDescription(), liveItems(m, now).stream()
                        .map(i -> new OutlineItem(i.getId(), i.getTitle(), i.getType(), i.getDurationMinutes()))
                        .toList()))
                .toList();
        int itemCount = outline.stream().mapToInt(m -> m.items().size()).sum();
        return new CoursePublicDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getLevel(),
                List.copyOf(c.getTags()), mediaMapper.url(c.getCoverImage()),
                new InstructorProfile(u.getId(), u.getFullName(), u.getBio(), userMapper.avatarUrl(u)),
                studentCount, outline.size(), itemCount, c.getEnrollmentMode(), c.effectivePublishedAt(),
                html(c.getDescription()), c.getCapacity(), outline);
    }

    // ---------- instructor (full tree incl. drafts) ----------

    public InstructorCourseDto toInstructorDto(Course c, long students, long pending, Instant now) {
        int items = c.getModules().stream().mapToInt(m -> m.getItems().size()).sum();
        return new InstructorCourseDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getLevel(),
                mediaMapper.url(c.getCoverImage()), c.getPublishStatus(), c.getPublishAt(), c.getUnpublishAt(),
                Visibility.of(c, now), students, pending, c.getModules().size(), items, c.getUpdatedAt());
    }

    public CourseDto toCourseDto(Course c, long students, long pending, Map<UUID, AssessmentSummaryDto> summaries,
                                 Instant now) {
        Map<UUID, List<PrerequisiteDto>> prereqs = prerequisiteIndex(c.getId());
        return new CourseDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), html(c.getDescription()), c.getLevel(),
                List.copyOf(c.getTags()), mediaMapper.toDto(c.getCoverImage()), c.getEnrollmentMode(), c.getCapacity(),
                c.getPublishStatus(), c.getPublishAt(), c.getUnpublishAt(), Visibility.of(c, now), students, pending,
                c.getProgression(), c.getClonedFromId(),
                c.getModules().stream().map(m -> toModuleDto(m, c.getId(), summaries, prereqs, now)).toList(),
                c.getCreatedAt(), c.getUpdatedAt());
    }

    public ModuleDto toModuleDto(CourseModule m, UUID courseId, Map<UUID, AssessmentSummaryDto> summaries,
                                 Map<UUID, List<PrerequisiteDto>> prereqs, Instant now) {
        return new ModuleDto(m.getId(), courseId, m.getTitle(), m.getDescription(), m.getPosition(),
                m.getPublishStatus(), m.getPublishAt(), m.getUnpublishAt(), Visibility.of(m, now),
                m.getReleaseOffsetDays(), prereqs.getOrDefault(m.getId(), List.of()),
                m.getItems().stream().map(i -> toItemDto(i, m.getId(), courseId, summaries.get(i.getId()), prereqs, now))
                        .toList());
    }

    public ContentItemDto toItemDto(ContentItem i, UUID moduleId, UUID courseId, AssessmentSummaryDto summary,
                                    Map<UUID, List<PrerequisiteDto>> prereqs, Instant now) {
        return new ContentItemDto(i.getId(), moduleId, courseId, i.getType(), i.getTitle(), i.getSummary(), html(i.getBody()),
                i.getExternalUrl(), i.getDurationMinutes(), i.getPosition(), i.getPublishStatus(), i.getPublishAt(),
                i.getUnpublishAt(), Visibility.of(i, now),
                i.getAttachments().stream().map(mediaMapper::toDto).toList(),
                i.getType().isAssessment() ? summary : null, i.isRequired(), i.getReleaseOffsetDays(),
                prereqs.getOrDefault(i.getId(), List.of()), i.getCreatedAt(), i.getUpdatedAt());
    }
}
