package de.sprachweg.course;

import de.sprachweg.common.publication.PublishStatus;
import de.sprachweg.common.publication.Visibility;
import de.sprachweg.media.MediaDto;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response records of the course domain (see PLAN.md §6). */
public final class CourseDtos {

    private CourseDtos() {
    }

    // ---------- requests ----------

    public record CourseUpsert(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 300) String subtitle,
            @Size(max = 200000) String description,
            @NotNull CefrLevel level,
            @Size(max = 20) List<@NotBlank @Size(max = 50) String> tags,
            UUID coverImageId,
            @NotNull EnrollmentMode enrollmentMode,
            @Min(1) @Max(100000) Integer capacity) {
    }

    public record ModuleUpsert(@NotBlank @Size(max = 200) String title, @Size(max = 5000) String description) {
    }

    public record ItemUpsert(
            @NotNull ItemType type,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 1000) String summary,
            @Size(max = 500000) String body,
            @Size(max = 2000) String externalUrl,
            @Min(0) @Max(10000) Integer durationMinutes,
            @Size(max = 100) List<@NotNull UUID> attachmentIds) {
    }

    // ---------- public / catalog ----------

    public record InstructorRef(UUID id, String fullName, String avatarUrl) {
    }

    public record InstructorProfile(UUID id, String fullName, String bio, String avatarUrl) {
    }

    public record CourseSummaryDto(UUID id, String slug, String title, String subtitle, CefrLevel level,
                                   List<String> tags, String coverImageUrl, InstructorRef instructor,
                                   long studentCount, int moduleCount, int itemCount, EnrollmentMode enrollmentMode,
                                   Instant publishedAt) {
    }

    public record OutlineItem(UUID id, String title, ItemType type, Integer durationMinutes) {
    }

    public record OutlineModule(UUID id, String title, String description, List<OutlineItem> items) {
    }

    public record CoursePublicDto(UUID id, String slug, String title, String subtitle, CefrLevel level,
                                  List<String> tags, String coverImageUrl, InstructorProfile instructor,
                                  long studentCount, int moduleCount, int itemCount, EnrollmentMode enrollmentMode,
                                  Instant publishedAt, String description, Integer capacity,
                                  List<OutlineModule> outline) {
    }

    /** CourseSummaryDto + description (used by the learner view). */
    public record CourseDetailDto(UUID id, String slug, String title, String subtitle, CefrLevel level,
                                  List<String> tags, String coverImageUrl, InstructorRef instructor,
                                  long studentCount, int moduleCount, int itemCount, EnrollmentMode enrollmentMode,
                                  Instant publishedAt, String description) {
    }

    // ---------- instructor ----------

    public record AssessmentSummaryDto(int questionCount, int totalPoints, Integer timeLimitMinutes) {
    }

    public record ContentItemDto(UUID id, UUID moduleId, UUID courseId, ItemType type, String title, String summary,
                                 String body, String externalUrl, Integer durationMinutes, int position,
                                 PublishStatus publishStatus, Instant publishAt, Instant unpublishAt,
                                 Visibility visibility, List<MediaDto> attachments, AssessmentSummaryDto assessment,
                                 Instant createdAt, Instant updatedAt) {
    }

    public record ModuleDto(UUID id, UUID courseId, String title, String description, int position,
                            PublishStatus publishStatus, Instant publishAt, Instant unpublishAt, Visibility visibility,
                            List<ContentItemDto> items) {
    }

    public record CourseDto(UUID id, String slug, String title, String subtitle, String description, CefrLevel level,
                            List<String> tags, MediaDto coverImage, EnrollmentMode enrollmentMode, Integer capacity,
                            PublishStatus publishStatus, Instant publishAt, Instant unpublishAt, Visibility visibility,
                            long studentCount, long pendingCount, List<ModuleDto> modules, Instant createdAt,
                            Instant updatedAt) {
    }

    public record InstructorCourseDto(UUID id, String slug, String title, String subtitle, CefrLevel level,
                                      String coverImageUrl, PublishStatus publishStatus, Instant publishAt,
                                      Instant unpublishAt, Visibility visibility, long studentCount, long pendingCount,
                                      int moduleCount, int itemCount, Instant updatedAt) {
    }
}
