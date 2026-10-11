package de.sprachweg.learning;

import de.sprachweg.course.CourseDtos.CourseDetailDto;
import de.sprachweg.course.ItemType;
import de.sprachweg.media.MediaDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LearningDtos {

    private LearningDtos() {
    }

    public record LearnOutlineItem(UUID id, String title, ItemType type, Integer durationMinutes, boolean completed) {
    }

    public record LearnModule(UUID id, String title, String description, List<LearnOutlineItem> items) {
    }

    public record LearnCourseDto(CourseDetailDto course, int progressPercent, List<LearnModule> modules) {
    }

    public record LearnAssessmentDto(String instructions, Integer timeLimitMinutes, int maxAttempts, int passingScore,
                                     int questionCount, int totalPoints, Instant availableFrom, Instant availableUntil,
                                     int attemptsUsed, Double bestPercent, UUID inProgressAttemptId) {
    }

    public record LearnItemDto(UUID id, UUID courseId, UUID moduleId, ItemType type, String title, String summary,
                               String body, String externalUrl, Integer durationMinutes, List<MediaDto> attachments,
                               boolean completed, UUID prevItemId, UUID nextItemId, LearnAssessmentDto assessment) {
    }
}
