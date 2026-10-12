package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.AnswerResult;
import me.amanullah.course.assessment.AssessmentDtos.AttemptResultDto;
import me.amanullah.course.assessment.AssessmentDtos.BlankResult;
import me.amanullah.course.assessment.AssessmentDtos.PairResult;
import me.amanullah.course.assessment.AssessmentDtos.SavedAnswer;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSessionDto;
import me.amanullah.course.assessment.AssessmentDtos.AttemptSummaryDto;
import me.amanullah.course.assessment.AssessmentDtos.ResultOption;
import me.amanullah.course.assessment.AssessmentDtos.SessionOption;
import me.amanullah.course.assessment.AssessmentDtos.SessionQuestion;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.user.UserMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class AttemptMapper {

    private final UserMapper userMapper;
    private final MediaMapper mediaMapper;

    public AttemptMapper(UserMapper userMapper, MediaMapper mediaMapper) {
        this.userMapper = userMapper;
        this.mediaMapper = mediaMapper;
    }

    public AttemptSessionDto toSession(Attempt a, Instant now) {
        List<SessionQuestion> questions = sorted(a).stream().map(this::sessionQuestion).toList();
        List<SavedAnswer> saved = sorted(a).stream()
                .filter(ans -> !ans.getSelectedOptionIds().isEmpty() || ans.getTextAnswer() != null
                        || !ans.getResponse().isEmpty() || ans.getResponseMedia() != null)
                .map(ans -> {
                    AnswerResponse r = ans.getResponse();
                    return new SavedAnswer(ans.getQuestionId(), List.copyOf(ans.getSelectedOptionIds()),
                            ans.getTextAnswer(), r.blanks(), r.pairs(), r.order(),
                            ans.getResponseMedia() == null ? null : ans.getResponseMedia().getId(),
                            mediaMapper.toDto(ans.getResponseMedia()));
                })
                .toList();
        return new AttemptSessionDto(a.getId(), a.getStatus(), a.getStartedAt(), AttemptFinalizer.effectiveDeadline(a),
                a.getAssessment().getTimeLimitMinutes(), a.getAssessment().getAvailableUntil(), now, questions, saved);
    }

    /** What the learner sees of a question: never which option, blank or pair is right. */
    private SessionQuestion sessionQuestion(AttemptAnswer ans) {
        QuestionType type = ans.getQuestionType();
        List<SessionOption> options = type.usesOptions()
                ? OptionOrder.display(ans).stream().map(o -> new SessionOption(o.getOptionId(), o.getText())).toList()
                : List.of();
        List<SessionOption> targets = type == QuestionType.MATCHING
                ? OptionOrder.matchTargets(ans).stream().map(o -> new SessionOption(o.getOptionId(), o.getMatchText())).toList()
                : null;
        Integer blankCount = null;
        if (type == QuestionType.CLOZE) {
            blankCount = ans.getBlankAnswers().size();
        } else if (type == QuestionType.WORD_BANK) {
            blankCount = (int) ans.getOptions().stream().filter(o -> o.getBlankIndex() != null).count();
        }
        return new SessionQuestion(ans.getQuestionId(), type, ans.getPrompt(), ans.getPoints(),
                mediaMapper.toDto(ans.getMedia()), options, blankCount, targets,
                type == QuestionType.SPEAKING ? ans.getMaxRecordingSeconds() : null);
    }

    public AttemptSummaryDto toSummary(Attempt a) {
        boolean submitted = a.getStatus() != AttemptStatus.IN_PROGRESS;
        Double percent = submitted ? Grader.percent(a.getScore(), a.getMaxScore()) : null;
        return new AttemptSummaryDto(a.getId(), userMapper.toSummary(a.getStudent()), a.getStatus(), a.getStartedAt(),
                a.getSubmittedAt(), submitted ? a.getScore() : null, a.getMaxScore(), percent, passed(a, percent),
                a.getStatus() == AttemptStatus.SUBMITTED, a.isLate(), a.isAutoSubmitted());
    }

    /**
     * @param revealSolutions whether correct options, accepted answers and explanations are included
     */
    public AttemptResultDto toResult(Attempt a, boolean revealSolutions) {
        AttemptSummaryDto s = toSummary(a);
        boolean submitted = a.getStatus() != AttemptStatus.IN_PROGRESS;
        boolean reveal = revealSolutions && submitted;
        List<AnswerResult> answers = sorted(a).stream().map(ans -> answerResult(ans, submitted, reveal)).toList();
        var item = a.getAssessment().getItem();
        return new AttemptResultDto(s.id(), s.student(), s.status(), s.startedAt(), s.submittedAt(), s.score(),
                s.maxScore(), s.percent(), s.passed(), s.pendingManualGrading(), s.late(), s.autoSubmitted(), item.getId(),
                item.getTitle(), a.getDeadline(), answers);
    }

    private AnswerResult answerResult(AttemptAnswer ans, boolean submitted, boolean reveal) {
        QuestionType type = ans.getQuestionType();
        AnswerResponse r = ans.getResponse();
        List<ResultOption> options = null;
        if (type.usesOptions()) {
            options = OptionOrder.display(ans).stream()
                    .map(o -> new ResultOption(o.getOptionId(), o.getText(),
                            reveal && (type.isChoice() || type == QuestionType.WORD_BANK) ? o.isCorrect() : null,
                            reveal && type == QuestionType.MATCHING ? o.getMatchText() : null,
                            reveal && type == QuestionType.WORD_BANK ? o.getBlankIndex() : null))
                    .toList();
        }
        List<BlankResult> blankResults = null;
        if (submitted && type.hasBlanks()) {
            blankResults = Grader.blankResults(ans).stream()
                    .map(b -> new BlankResult(b.index(), b.given(), b.correct(), reveal ? b.expected() : null)).toList();
        }
        List<PairResult> pairResults = null;
        if (submitted && type == QuestionType.MATCHING) {
            pairResults = Grader.pairResults(ans).stream()
                    .map(p -> new PairResult(p.leftId(), p.left(), p.rightId(), p.right(), p.correct(),
                            reveal ? p.expectedRight() : null)).toList();
        }
        List<UUID> correctOrder = reveal && type == QuestionType.ORDERING
                ? ans.getOptions().stream().map(AnswerOptionSnapshot::getOptionId).toList() : null;
        boolean referenceText = type.isText() || type == QuestionType.DICTATION;
        return new AnswerResult(
                ans.getQuestionId(), type, ans.getPrompt(), ans.getPoints(),
                List.copyOf(ans.getSelectedOptionIds()), ans.getTextAnswer(),
                submitted ? ans.getCorrect() : null, submitted ? ans.getPointsAwarded() : null, ans.getFeedback(),
                options,
                reveal && referenceText ? List.copyOf(ans.getAcceptedAnswers()) : null,
                reveal ? ans.getExplanation() : null,
                mediaMapper.toDto(ans.getMedia()),
                ans.getScoring(),
                type.hasBlanks() ? r.blanks() : null, type == QuestionType.MATCHING ? r.pairs() : null,
                type == QuestionType.ORDERING ? r.order() : null,
                blankResults, pairResults, correctOrder,
                mediaMapper.toDto(ans.getResponseMedia()),
                type == QuestionType.SPEAKING ? ans.getMaxRecordingSeconds() : null);
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
