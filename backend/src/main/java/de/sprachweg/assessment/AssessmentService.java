package de.sprachweg.assessment;

import de.sprachweg.assessment.AssessmentDtos.AssessmentDto;
import de.sprachweg.assessment.AssessmentDtos.AssessmentUpsert;
import de.sprachweg.assessment.AssessmentDtos.OptionDto;
import de.sprachweg.assessment.AssessmentDtos.OptionUpsert;
import de.sprachweg.assessment.AssessmentDtos.QuestionDto;
import de.sprachweg.assessment.AssessmentDtos.QuestionUpsert;
import de.sprachweg.common.exception.NotFoundException;
import de.sprachweg.common.exception.ValidationException;
import de.sprachweg.common.util.HtmlSanitizer;
import de.sprachweg.course.ContentItem;
import de.sprachweg.course.CourseAccess;
import de.sprachweg.course.ItemType;
import de.sprachweg.media.MediaAsset;
import de.sprachweg.media.MediaMapper;
import de.sprachweg.media.MediaService;
import de.sprachweg.security.CurrentUser;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Quiz/exam builder (instructor side). */
@Service
public class AssessmentService {

    private final AssessmentRepository assessments;
    private final CourseAccess access;
    private final MediaService mediaService;
    private final MediaMapper mediaMapper;

    public AssessmentService(AssessmentRepository assessments, CourseAccess access, MediaService mediaService,
                             MediaMapper mediaMapper) {
        this.assessments = assessments;
        this.access = access;
        this.mediaService = mediaService;
        this.mediaMapper = mediaMapper;
    }

    /** Creates the assessment for a QUIZ/EXAM item if it does not exist yet, with sensible defaults. */
    @Transactional
    public Assessment ensureFor(ContentItem item) {
        return assessments.findByItemId(item.getId()).orElseGet(() -> {
            Assessment a = new Assessment(item);
            if (item.getType() == ItemType.EXAM) {
                a.setMaxAttempts(1);
                a.setTimeLimitMinutes(60);
                a.setShowCorrectAnswers(false);
            } else {
                a.setMaxAttempts(0);
                a.setShowCorrectAnswers(true);
            }
            a.setPassingScore(60);
            return assessments.save(a);
        });
    }

    @Transactional(readOnly = true)
    public AssessmentDto get(CurrentUser me, UUID itemId) {
        ContentItem item = access.item(itemId, me);
        return toDto(require(item));
    }

    @Transactional
    public AssessmentDto replace(CurrentUser me, UUID itemId, AssessmentUpsert req) {
        ContentItem item = access.item(itemId, me);
        if (!item.getType().isAssessment()) {
            throw new NotFoundException("ASSESSMENT_NOT_FOUND", "This item is not a quiz or exam");
        }
        Assessment a = ensureFor(item);
        validate(req);
        a.setInstructions(HtmlSanitizer.sanitize(req.instructions()));
        a.setTimeLimitMinutes(req.timeLimitMinutes());
        a.setMaxAttempts(req.maxAttempts() == null ? 0 : req.maxAttempts());
        a.setPassingScore(req.passingScore() == null ? 60 : req.passingScore());
        a.setShuffleQuestions(Boolean.TRUE.equals(req.shuffleQuestions()));
        a.setShowCorrectAnswers(req.showCorrectAnswers() == null || req.showCorrectAnswers());
        a.setAvailableFrom(req.availableFrom());
        a.setAvailableUntil(req.availableUntil());

        Map<UUID, Question> existing = new HashMap<>();
        a.getQuestions().forEach(q -> existing.put(q.getId(), q));
        List<QuestionUpsert> requested = sortByPosition(req.questions() == null ? List.of() : req.questions(),
                QuestionUpsert::position);
        List<Question> kept = new ArrayList<>();
        for (int i = 0; i < requested.size(); i++) {
            QuestionUpsert qr = requested.get(i);
            Question q;
            if (qr.id() != null) {
                q = existing.remove(qr.id());
                if (q == null) {
                    throw new ValidationException("Unknown question id", Map.of("questions[" + i + "].id", "unknown question"));
                }
            } else {
                q = new Question(a);
                a.getQuestions().add(q);
            }
            applyQuestion(q, qr, i, me);
            kept.add(q);
        }
        a.getQuestions().removeIf(q -> !kept.contains(q));
        item.touch();
        assessments.flush();
        return toDto(a);
    }

    private void applyQuestion(Question q, QuestionUpsert qr, int position, CurrentUser me) {
        q.setType(qr.type());
        q.setPrompt(HtmlSanitizer.sanitize(qr.prompt()));
        q.setExplanation(HtmlSanitizer.sanitize(qr.explanation()));
        q.setPoints(qr.points() == null ? 1 : qr.points());
        q.setPosition(position);
        q.setCaseSensitive(Boolean.TRUE.equals(qr.caseSensitive()));
        q.setAcceptedAnswers(qr.type().isText() && qr.acceptedAnswers() != null
                ? qr.acceptedAnswers().stream().map(String::strip).filter(s -> !s.isEmpty()).distinct().toList()
                : List.of());
        if (qr.mediaId() == null) {
            q.setMedia(null);
        } else if (q.getMedia() == null || !Objects.equals(q.getMedia().getId(), qr.mediaId())) {
            MediaAsset media = mediaService.requireUsable(qr.mediaId(), me.id(), me.isAdmin());
            q.setMedia(media);
        }

        Map<UUID, QuestionOption> existing = new HashMap<>();
        q.getOptions().forEach(o -> existing.put(o.getId(), o));
        List<OptionUpsert> requested = qr.type().isChoice() && qr.options() != null
                ? sortByPosition(qr.options(), OptionUpsert::position) : List.of();
        List<QuestionOption> kept = new ArrayList<>();
        for (int i = 0; i < requested.size(); i++) {
            OptionUpsert or = requested.get(i);
            QuestionOption o = or.id() == null ? null : existing.remove(or.id());
            if (o == null) {
                o = new QuestionOption(q);
                q.getOptions().add(o);
            }
            o.setText(or.text().strip());
            o.setCorrect(Boolean.TRUE.equals(or.correct()));
            o.setPosition(i);
            kept.add(o);
        }
        q.getOptions().removeIf(o -> !kept.contains(o));
    }

    private static <T> List<T> sortByPosition(List<T> list, java.util.function.Function<T, Integer> pos) {
        return IntStream.range(0, list.size()).boxed()
                .sorted(Comparator.comparingInt(i -> pos.apply(list.get(i)) == null ? i : pos.apply(list.get(i))))
                .map(list::get).toList();
    }

    static void validate(AssessmentUpsert req) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (req.availableFrom() != null && req.availableUntil() != null
                && !req.availableUntil().isAfter(req.availableFrom())) {
            errors.put("availableUntil", "must be after availableFrom");
        }
        List<QuestionUpsert> qs = req.questions() == null ? List.of() : req.questions();
        for (int i = 0; i < qs.size(); i++) {
            QuestionUpsert q = qs.get(i);
            String p = "questions[" + i + "]";
            if (q.type().isChoice()) {
                List<OptionUpsert> opts = q.options() == null ? List.of() : q.options();
                long correct = opts.stream().filter(o -> Boolean.TRUE.equals(o.correct())).count();
                if (opts.size() < 2) {
                    errors.put(p + ".options", "needs at least two options");
                } else if (correct == 0) {
                    errors.put(p + ".options", "needs at least one correct option");
                } else if (q.type() != QuestionType.MULTIPLE_CHOICE && correct != 1) {
                    errors.put(p + ".options", "needs exactly one correct option");
                }
                if (q.type() == QuestionType.TRUE_FALSE && opts.size() != 2) {
                    errors.put(p + ".options", "a true/false question has exactly two options");
                }
            } else if (q.type().isText()) {
                boolean any = q.acceptedAnswers() != null && q.acceptedAnswers().stream().anyMatch(s -> !s.isBlank());
                if (!any) {
                    errors.put(p + ".acceptedAnswers", "needs at least one accepted answer");
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException("The assessment is invalid", errors);
        }
    }

    Assessment require(ContentItem item) {
        if (!item.getType().isAssessment()) {
            throw new NotFoundException("ASSESSMENT_NOT_FOUND", "This item is not a quiz or exam");
        }
        return assessments.findByItemId(item.getId()).orElseGet(() -> ensureFor(item));
    }

    public AssessmentDto toDto(Assessment a) {
        List<QuestionDto> questions = a.getQuestions().stream()
                .sorted(Comparator.comparingInt(Question::getPosition))
                .map(q -> new QuestionDto(q.getId(), q.getType(), q.getPrompt(), q.getExplanation(), q.getPoints(),
                        q.getPosition(), q.isCaseSensitive(), List.copyOf(q.getAcceptedAnswers()),
                        q.getMedia() == null ? null : q.getMedia().getId(), mediaMapper.toDto(q.getMedia()),
                        q.getOptions().stream().sorted(Comparator.comparingInt(QuestionOption::getPosition))
                                .map(o -> new OptionDto(o.getId(), o.getText(), o.isCorrect(), o.getPosition()))
                                .toList()))
                .toList();
        return new AssessmentDto(a.getItem().getId(), a.getInstructions(), a.getTimeLimitMinutes(), a.getMaxAttempts(),
                a.getPassingScore(), a.isShuffleQuestions(), a.isShowCorrectAnswers(), a.getAvailableFrom(),
                a.getAvailableUntil(), questions);
    }
}
