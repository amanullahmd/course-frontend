package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.AssessmentDto;
import me.amanullah.course.assessment.AssessmentDtos.AssessmentUpsert;
import me.amanullah.course.assessment.AssessmentDtos.OptionDto;
import me.amanullah.course.assessment.AssessmentDtos.OptionUpsert;
import me.amanullah.course.assessment.AssessmentDtos.QuestionDto;
import me.amanullah.course.assessment.AssessmentDtos.QuestionUpsert;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.MessageRef;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.common.util.TextLimits;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaMapper;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.security.CurrentUser;
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

    public static final int MIN_RECORDING_SECONDS = 10;
    public static final int MAX_RECORDING_SECONDS = 600;

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
        a.setInstructions(TextLimits.requireMax("instructions", HtmlSanitizer.sanitize(req.instructions()), 20_000));
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
                    throw ValidationException.field("questions[" + i + "].id", "validation.unknownQuestion");
                }
            } else {
                q = new Question(a);
                a.getQuestions().add(q);
            }
            applyQuestion(q, qr, i, me, "questions[" + i + "]");
            kept.add(q);
        }
        a.getQuestions().removeIf(q -> !kept.contains(q));
        item.touch();
        assessments.flush();
        return toDto(a);
    }

    private void applyQuestion(Question q, QuestionUpsert qr, int position, CurrentUser me, String path) {
        q.setType(qr.type());
        q.setPrompt(TextLimits.requireMax(path + ".prompt", HtmlSanitizer.sanitize(qr.prompt()), 20_000));
        q.setExplanation(TextLimits.requireMax(path + ".explanation", HtmlSanitizer.sanitize(qr.explanation()), 20_000));
        q.setPoints(qr.points() == null ? 1 : qr.points());
        q.setPosition(position);
        q.setCaseSensitive(Boolean.TRUE.equals(qr.caseSensitive()));
        QuestionType type = qr.type();
        q.setScoring(type.supportsPartialCredit() && qr.scoring() == Scoring.PARTIAL
                ? Scoring.PARTIAL : Scoring.ALL_OR_NOTHING);
        q.setShuffleOptions(type.supportsShuffle() && Boolean.TRUE.equals(qr.shuffleOptions()));
        q.setLenientSpelling(type.supportsLenientSpelling() && Boolean.TRUE.equals(qr.lenientSpelling()));
        q.setMaxRecordingSeconds(type == QuestionType.SPEAKING ? qr.maxRecordingSeconds() : null);
        if (type == QuestionType.CLOZE) {
            q.setBlankAnswers(clozeAnswers(qr));
        } else if (type.isText() || type == QuestionType.DICTATION) {
            q.setAcceptedAnswers(cleanAnswers(qr.acceptedAnswers()));
        } else {
            q.setAcceptedAnswers(List.of());
        }
        if (qr.mediaId() == null) {
            q.setMedia(null);
        } else if (q.getMedia() == null || !Objects.equals(q.getMedia().getId(), qr.mediaId())) {
            MediaAsset media = mediaService.requireUsable(qr.mediaId(), me.id(), me.isAdmin());
            q.setMedia(media);
        }

        Map<UUID, QuestionOption> existing = new HashMap<>();
        q.getOptions().forEach(o -> existing.put(o.getId(), o));
        List<OptionUpsert> requested = type.usesOptions() && qr.options() != null
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
            o.setPosition(i);
            if (type == QuestionType.WORD_BANK) {
                o.setBlankIndex(or.blankIndex());
                o.setCorrect(or.blankIndex() != null);
                o.setMatchText(null);
            } else if (type == QuestionType.MATCHING) {
                o.setMatchText(or.matchText() == null ? null : or.matchText().strip());
                o.setBlankIndex(null);
                o.setCorrect(false);
            } else if (type == QuestionType.ORDERING) {
                o.setMatchText(null);
                o.setBlankIndex(null);
                o.setCorrect(false);
            } else {
                o.setMatchText(null);
                o.setBlankIndex(null);
                o.setCorrect(Boolean.TRUE.equals(or.correct()));
            }
            kept.add(o);
        }
        q.getOptions().removeIf(o -> !kept.contains(o));
    }

    private static List<String> cleanAnswers(List<String> answers) {
        return answers == null ? List.of()
                : answers.stream().map(String::strip).filter(x -> !x.isEmpty()).distinct().toList();
    }

    /** Accepted answers per blank, only for blanks that have a marker in the prompt. */
    private static Map<Integer, List<String>> clozeAnswers(QuestionUpsert qr) {
        List<Integer> markers = ClozeParser.distinct(qr.prompt());
        Map<Integer, List<String>> byBlank = new java.util.TreeMap<>();
        if (qr.blanks() != null) {
            for (AssessmentDtos.BlankUpsert b : qr.blanks()) {
                if (markers.contains(b.index())) {
                    byBlank.computeIfAbsent(b.index(), k -> new ArrayList<>()).addAll(cleanAnswers(b.acceptedAnswers()));
                }
            }
        }
        byBlank.replaceAll((k, v) -> v.stream().distinct().toList());
        return byBlank;
    }

    private static <T> List<T> sortByPosition(List<T> list, java.util.function.Function<T, Integer> pos) {
        return IntStream.range(0, list.size()).boxed()
                .sorted(Comparator.comparingInt(i -> pos.apply(list.get(i)) == null ? i : pos.apply(list.get(i))))
                .map(list::get).toList();
    }

    void validate(AssessmentUpsert req) {
        Map<String, MessageRef> errors = new LinkedHashMap<>();
        if (req.availableFrom() != null && req.availableUntil() != null
                && !req.availableUntil().isAfter(req.availableFrom())) {
            errors.put("availableUntil", new MessageRef("validation.availableUntilAfterFrom"));
        }
        List<QuestionUpsert> qs = req.questions() == null ? List.of() : req.questions();
        for (int i = 0; i < qs.size(); i++) {
            QuestionUpsert q = qs.get(i);
            String p = "questions[" + i + "]";
            if (q.type().isChoice()) {
                List<OptionUpsert> opts = q.options() == null ? List.of() : q.options();
                long correct = opts.stream().filter(o -> Boolean.TRUE.equals(o.correct())).count();
                if (opts.size() < 2) {
                    errors.put(p + ".options", new MessageRef("validation.options.min2"));
                } else if (correct == 0) {
                    errors.put(p + ".options", new MessageRef("validation.options.oneCorrect"));
                } else if (q.type() != QuestionType.MULTIPLE_CHOICE && correct != 1) {
                    errors.put(p + ".options", new MessageRef("validation.options.exactlyOne"));
                }
                if (q.type() == QuestionType.TRUE_FALSE && opts.size() != 2) {
                    errors.put(p + ".options", new MessageRef("validation.options.trueFalse"));
                }
            } else if (q.type().isText()) {
                boolean any = q.acceptedAnswers() != null && q.acceptedAnswers().stream().anyMatch(s -> !s.isBlank());
                if (!any) {
                    errors.put(p + ".acceptedAnswers", new MessageRef("validation.acceptedAnswers.required"));
                }
            } else {
                validateLanguage(q, p, errors);
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    /** Checks the language question types; errors are reported per question index and field. */
    private void validateLanguage(QuestionUpsert q, String p, Map<String, MessageRef> errors) {
        List<OptionUpsert> opts = q.options() == null ? List.of() : q.options();
        switch (q.type()) {
            case CLOZE -> {
                List<Integer> markers = ClozeParser.distinct(q.prompt());
                if (markers.isEmpty()) {
                    errors.put(p + ".prompt", new MessageRef("question.invalid.cloze.noBlanks"));
                } else if (ClozeParser.hasDuplicates(q.prompt())) {
                    errors.put(p + ".prompt", new MessageRef("question.invalid.cloze.duplicateMarker"));
                } else if (markers.size() > ClozeParser.MAX_BLANKS || markers.getLast() > ClozeParser.MAX_BLANKS) {
                    errors.put(p + ".prompt", new MessageRef("question.invalid.cloze.tooMany", ClozeParser.MAX_BLANKS));
                } else {
                    Map<Integer, Boolean> answered = new HashMap<>();
                    if (q.blanks() != null) {
                        q.blanks().forEach(b -> {
                            if (b.acceptedAnswers() != null && b.acceptedAnswers().stream().anyMatch(a -> !a.isBlank())) {
                                answered.put(b.index(), true);
                            }
                        });
                    }
                    for (int m : markers) {
                        if (!answered.containsKey(m)) {
                            errors.put(p + ".blanks", new MessageRef("question.invalid.cloze.noAnswer", m));
                            break;
                        }
                    }
                }
            }
            case WORD_BANK -> {
                List<Integer> markers = ClozeParser.distinct(q.prompt());
                if (markers.isEmpty()) {
                    errors.put(p + ".prompt", new MessageRef("question.invalid.cloze.noBlanks"));
                } else if (ClozeParser.hasDuplicates(q.prompt())) {
                    errors.put(p + ".prompt", new MessageRef("question.invalid.cloze.duplicateMarker"));
                } else if (opts.size() < markers.size() || opts.size() < 2) {
                    errors.put(p + ".options", new MessageRef("question.invalid.wordBank.chips"));
                } else {
                    for (int m : markers) {
                        long chips = opts.stream().filter(o -> Integer.valueOf(m).equals(o.blankIndex())).count();
                        if (chips == 0) {
                            errors.put(p + ".options", new MessageRef("question.invalid.wordBank.missingChip", m));
                            break;
                        } else if (chips > 1) {
                            errors.put(p + ".options", new MessageRef("question.invalid.wordBank.duplicateChip", m));
                            break;
                        }
                    }
                    if (!errors.containsKey(p + ".options")
                            && opts.stream().anyMatch(o -> o.blankIndex() != null && !markers.contains(o.blankIndex()))) {
                        errors.put(p + ".options", new MessageRef("question.invalid.wordBank.unknownBlank"));
                    }
                }
            }
            case MATCHING -> {
                if (opts.size() < 2) {
                    errors.put(p + ".options", new MessageRef("question.invalid.matching.min"));
                } else if (opts.stream().anyMatch(o -> o.matchText() == null || o.matchText().isBlank())) {
                    errors.put(p + ".options", new MessageRef("question.invalid.matching.matchText"));
                }
            }
            case ORDERING -> {
                if (opts.size() < 2) {
                    errors.put(p + ".options", new MessageRef("question.invalid.ordering.min"));
                }
            }
            case DICTATION -> {
                if (q.mediaId() == null || mediaService.kindOf(q.mediaId()) != MediaKind.AUDIO) {
                    errors.put(p + ".mediaId", new MessageRef("question.invalid.dictation.audio"));
                }
                boolean any = q.acceptedAnswers() != null && q.acceptedAnswers().stream().anyMatch(a -> !a.isBlank());
                if (!any) {
                    errors.put(p + ".acceptedAnswers", new MessageRef("question.invalid.dictation.reference"));
                }
            }
            case SPEAKING -> {
                Integer max = q.maxRecordingSeconds();
                if (max == null || max < MIN_RECORDING_SECONDS || max > MAX_RECORDING_SECONDS) {
                    errors.put(p + ".maxRecordingSeconds", new MessageRef("question.invalid.speaking.duration",
                            MIN_RECORDING_SECONDS, MAX_RECORDING_SECONDS));
                }
            }
            default -> {
            }
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
                                .map(o -> new OptionDto(o.getId(), o.getText(), o.isCorrect(), o.getPosition(),
                                        o.getMatchText(), o.getBlankIndex()))
                                .toList(),
                        q.getScoring(), q.isShuffleOptions(), q.isLenientSpelling(), q.getMaxRecordingSeconds(),
                        q.getBlankAnswers().entrySet().stream()
                                .map(e -> new AssessmentDtos.BlankDto(e.getKey(), List.copyOf(e.getValue()))).toList()))
                .toList();
        return new AssessmentDto(a.getItem().getId(), a.getInstructions(), a.getTimeLimitMinutes(), a.getMaxAttempts(),
                a.getPassingScore(), a.isShuffleQuestions(), a.isShowCorrectAnswers(), a.getAvailableFrom(),
                a.getAvailableUntil(), questions);
    }
}
