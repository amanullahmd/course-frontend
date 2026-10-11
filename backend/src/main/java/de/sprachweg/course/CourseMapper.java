package de.sprachweg.course;

import de.sprachweg.common.publication.Visibility;
import de.sprachweg.course.CourseDtos.AssessmentSummaryDto;
import de.sprachweg.course.CourseDtos.ContentItemDto;
import de.sprachweg.course.CourseDtos.CourseDetailDto;
import de.sprachweg.course.CourseDtos.CourseDto;
import de.sprachweg.course.CourseDtos.CoursePublicDto;
import de.sprachweg.course.CourseDtos.CourseSummaryDto;
import de.sprachweg.course.CourseDtos.InstructorCourseDto;
import de.sprachweg.course.CourseDtos.InstructorProfile;
import de.sprachweg.course.CourseDtos.InstructorRef;
import de.sprachweg.course.CourseDtos.ModuleDto;
import de.sprachweg.course.CourseDtos.OutlineItem;
import de.sprachweg.course.CourseDtos.OutlineModule;
import de.sprachweg.media.MediaMapper;
import de.sprachweg.media.MediaUrlSigner;
import de.sprachweg.user.User;
import de.sprachweg.user.UserMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class CourseMapper {

    private final MediaMapper mediaMapper;
    private final UserMapper userMapper;
    private final MediaUrlSigner signer;

    public CourseMapper(MediaMapper mediaMapper, UserMapper userMapper, MediaUrlSigner signer) {
        this.mediaMapper = mediaMapper;
        this.userMapper = userMapper;
        this.signer = signer;
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
        return new CourseDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), html(c.getDescription()), c.getLevel(),
                List.copyOf(c.getTags()), mediaMapper.toDto(c.getCoverImage()), c.getEnrollmentMode(), c.getCapacity(),
                c.getPublishStatus(), c.getPublishAt(), c.getUnpublishAt(), Visibility.of(c, now), students, pending,
                c.getModules().stream().map(m -> toModuleDto(m, c.getId(), summaries, now)).toList(),
                c.getCreatedAt(), c.getUpdatedAt());
    }

    public ModuleDto toModuleDto(CourseModule m, UUID courseId, Map<UUID, AssessmentSummaryDto> summaries, Instant now) {
        return new ModuleDto(m.getId(), courseId, m.getTitle(), m.getDescription(), m.getPosition(),
                m.getPublishStatus(), m.getPublishAt(), m.getUnpublishAt(), Visibility.of(m, now),
                m.getItems().stream().map(i -> toItemDto(i, m.getId(), courseId, summaries.get(i.getId()), now)).toList());
    }

    public ContentItemDto toItemDto(ContentItem i, UUID moduleId, UUID courseId, AssessmentSummaryDto summary,
                                    Instant now) {
        return new ContentItemDto(i.getId(), moduleId, courseId, i.getType(), i.getTitle(), i.getSummary(), html(i.getBody()),
                i.getExternalUrl(), i.getDurationMinutes(), i.getPosition(), i.getPublishStatus(), i.getPublishAt(),
                i.getUnpublishAt(), Visibility.of(i, now),
                i.getAttachments().stream().map(mediaMapper::toDto).toList(),
                i.getType().isAssessment() ? summary : null, i.getCreatedAt(), i.getUpdatedAt());
    }
}
