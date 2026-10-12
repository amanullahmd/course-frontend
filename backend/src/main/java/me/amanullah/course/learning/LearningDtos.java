package me.amanullah.course.learning;

import me.amanullah.course.course.CourseDtos.CourseDetailDto;
import me.amanullah.course.course.CourseProgression;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.media.MediaDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LearningDtos {

    private LearningDtos() {
    }

    public record LockPrerequisite(UUID itemId, String title, Integer minPercent) {
    }

    /** Why an item is locked: {@code reason} is DATE, PREREQUISITE or SEQUENCE. */
    public record LockDto(String reason, Instant unlockAt, List<LockPrerequisite> prerequisites) {
    }

    public record LearnOutlineItem(UUID id, String title, ItemType type, Integer durationMinutes, boolean completed,
                                   boolean required, LockDto lock) {
    }

    public record LearnModule(UUID id, String title, String description, List<LearnOutlineItem> items) {
    }

    public record LearnCourseDto(CourseDetailDto course, int progressPercent, CourseProgression progression,
                                 int requiredCount, int completedRequiredCount, List<LearnModule> modules) {
    }

    public record LearnAssessmentDto(String instructions, Integer timeLimitMinutes, int maxAttempts, int passingScore,
                                     int questionCount, int totalPoints, Instant availableFrom, Instant availableUntil,
                                     int attemptsUsed, Double bestPercent, UUID inProgressAttemptId) {
    }

    public record LearnItemDto(UUID id, UUID courseId, UUID moduleId, ItemType type, String title, String summary,
                               String body, String externalUrl, Integer durationMinutes, List<MediaDto> attachments,
                               boolean completed, UUID prevItemId, UUID nextItemId, LearnAssessmentDto assessment,
                               boolean required) {
    }
}
