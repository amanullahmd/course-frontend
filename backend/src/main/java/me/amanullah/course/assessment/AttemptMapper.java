package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.AnswerResult;
import me.amanullah.course.assessment.AssessmentDtos.AttemptResultDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSessionDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSummaryDto;
import me.amanullah.course.assessment.AssessmentDtos.ResultOption;
import me.amanullah.course.assessment.AssessmentDtos.SessionOption;
import me.amanullah.course.assessment.AssessmentDtos.SessionQuestion;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.user.UserMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AttemptMapper {

    private final UserMapper userMapper;
    private final MediaMapper mediaMapper;

    public AttemptMapper(UserMapper userMapper, MediaMapper mediaMapper) {
        this.userMapper = userMapper;
        this.mediaMapper = mediaMapper;
    }

    public AttemptSessionDto toSession(Attempt a) {
        List<SessionQuestion> questions = sorted(a).stream()
                .map(ans -> new SessionQuestion(ans.getQuestionId(), ans.getQuestionType(), ans.getPrompt(),
                        ans.getPoints(), mediaMapper.toDto(ans.getMedia()),
                        ans.getOptions().stream().map(o -> new SessionOption(o.getOptionId(), o.getText())).toList()))
                .toList();
        return new AttemptSessionDto(a.getId(), a.getStatus(), a.getStartedAt(), a.getDeadline(), questions);
    }

    public AttemptSummaryDto toSummary(Attempt a) {
        boolean submitted = a.getStatus() != AttemptStatus.IN_PROGRESS;
        Double percent = submitted ? Grader.percent(a.getScore(), a.getMaxScore()) : null;
        return new AttemptSummaryDto(a.getId(), userMapper.toSummary(a.getStudent()), a.getStatus(), a.getStartedAt(),
                a.getSubmittedAt(), submitted ? a.getScore() : null, a.getMaxScore(), percent, passed(a, percent),
                a.getStatus() == AttemptStatus.SUBMITTED, a.isLate());
    }

    /**
     * @param revealSolutions whether correct options, accepted answers and explanations are included
     */
    public AttemptResultDto toResult(Attempt a, boolean revealSolutions) {
        AttemptSummaryDto s = toSummary(a);
        boolean submitted = a.getStatus() != AttemptStatus.IN_PROGRESS;
        List<AnswerResult> answers = sorted(a).stream().map(ans -> new AnswerResult(
                ans.getQuestionId(), ans.getQuestionType(), ans.getPrompt(), ans.getPoints(),
                List.copyOf(ans.getSelectedOptionIds()), ans.getTextAnswer(),
                submitted ? ans.getCorrect() : null, submitted ? ans.getPointsAwarded() : null, ans.getFeedback(),
                ans.getQuestionType().isChoice()
                        ? ans.getOptions().stream().map(o -> new ResultOption(o.getOptionId(), o.getText(),
                        revealSolutions && submitted ? o.isCorrect() : null)).toList()
                        : null,
                revealSolutions && submitted && ans.getQuestionType().isText() ? List.copyOf(ans.getAcceptedAnswers()) : null,
                revealSolutions && submitted ? ans.getExplanation() : null,
                mediaMapper.toDto(ans.getMedia())
        )).toList();
        var item = a.getAssessment().getItem();
        return new AttemptResultDto(s.id(), s.student(), s.status(), s.startedAt(), s.submittedAt(), s.score(),
                s.maxScore(), s.percent(), s.passed(), s.pendingManualGrading(), s.late(), item.getId(),
                item.getTitle(), a.getDeadline(), answers);
    }

    private static Boolean passed(Attempt a, Double percent) {
        if (a.getStatus() != AttemptStatus.GRADED || percent == null) {
            return null;
        }
        return percent >= a.getAssessment().getPassingScore();
    }

    private static List<AttemptAnswer> sorted(Attempt a) {
        List<AttemptAnswer> list = new ArrayList<>(a.getAnswers());
        list.sort(Comparator.comparingInt(AttemptAnswer::getPosition));
        return list;
    }
}
