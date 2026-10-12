package me.amanullah.course.assignment;

import me.amanullah.course.assignment.AssignmentDtos.AssignmentDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionFileDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionSummaryDto;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.user.UserMapper;
import org.springframework.stereotype.Component;

@Component
public class AssignmentMapper {

    private final MediaMapper media;
    private final UserMapper users;

    public AssignmentMapper(MediaMapper media, UserMapper users) {
        this.media = media;
        this.users = users;
    }

    public AssignmentDto toDto(Assignment a) {
        return new AssignmentDto(a.getItem().getId(), a.getDueAt(), a.isAllowLate(), a.getMaxPoints(), a.getMaxFiles(),
                a.getMaxSubmissions(), a.isAllowText());
    }

    /** Learners see points and feedback only after the instructor returned or graded that version. */
    public SubmissionDto toLearnerDto(AssignmentSubmission s) {
        boolean reviewed = s.getStatus() != SubmissionStatus.SUBMITTED;
        return new SubmissionDto(s.getId(), s.getAssignment().getItem().getId(), s.getVersionNo(), s.getStatus(),
                s.getTextAnswer(), files(s, reviewed), s.getSubmittedAt(), s.isLate(), reviewed ? s.getPoints() : null,
                s.getAssignment().getMaxPoints(), reviewed ? s.getFeedback() : null, reviewed ? s.getGradedAt() : null);
    }

    public SubmissionDto toInstructorDto(AssignmentSubmission s) {
        return new SubmissionDto(s.getId(), s.getAssignment().getItem().getId(), s.getVersionNo(), s.getStatus(),
                s.getTextAnswer(), files(s, true), s.getSubmittedAt(), s.isLate(), s.getPoints(),
                s.getAssignment().getMaxPoints(), s.getFeedback(), s.getGradedAt());
    }

    public SubmissionSummaryDto toSummary(AssignmentSubmission s) {
        var item = s.getAssignment().getItem();
        long fileCount = s.getFiles().stream().filter(f -> !f.isFeedbackFile()).count();
        return new SubmissionSummaryDto(s.getId(), item.getId(), item.getTitle(), item.getModule().getCourse().getId(),
                users.toSummary(s.getStudent()), s.getVersionNo(), s.getStatus(), s.isLate(), s.getSubmittedAt(),
                s.getPoints(), s.getAssignment().getMaxPoints(), (int) fileCount,
                s.getTextAnswer() != null && !s.getTextAnswer().isBlank());
    }

    private java.util.List<SubmissionFileDto> files(AssignmentSubmission s, boolean withFeedbackFiles) {
        return s.getFiles().stream().filter(f -> withFeedbackFiles || !f.isFeedbackFile())
                .map(f -> new SubmissionFileDto(media.toDto(f.getMedia()), f.isFeedbackFile())).toList();
    }
}
