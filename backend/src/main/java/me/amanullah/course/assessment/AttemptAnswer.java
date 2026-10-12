package me.amanullah.course.assessment;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.media.MediaAsset;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One answer of an attempt, including a snapshot of the question (prompt, points, options, accepted answers) so
 * later edits of the assessment never change or break historic attempts.
 */
@Entity
@Table(name = "attempt_answers")
public class AttemptAnswer extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private Attempt attempt;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "question_type", nullable = false, length = 20)
    private QuestionType questionType;

    @Column(nullable = false, length = 20000)
    private String prompt;

    @Column(length = 20000)
    private String explanation;

    @Column(nullable = false)
    private int points;

    @Column(name = "sort_order", nullable = false)
    private int position;

    @Column(name = "case_sensitive", nullable = false)
    private boolean caseSensitive;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_id")
    private MediaAsset media;

    @ElementCollection
    @CollectionTable(name = "attempt_answer_options", joinColumns = @JoinColumn(name = "answer_id"))
    @OrderColumn(name = "sort_order")
    private List<AnswerOptionSnapshot> options = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "attempt_answer_accepted", joinColumns = @JoinColumn(name = "answer_id"))
    @OrderColumn(name = "sort_order")
    private List<AcceptedAnswer> accepted = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private Scoring scoring = Scoring.ALL_OR_NOTHING;

    @Column(name = "shuffle_options", nullable = false)
    private boolean shuffleOptions;

    @Column(name = "lenient_spelling", nullable = false)
    private boolean lenientSpelling;

    @Column(name = "max_recording_seconds")
    private Integer maxRecordingSeconds;

    /** Structured response of CLOZE, WORD_BANK, MATCHING and ORDERING answers, see {@link AnswerResponse}. */
    @Column(name = "response_json", length = 20000)
    private String responseJson;

    /** SPEAKING: the learner's recording. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "response_media_id")
    private MediaAsset responseMedia;

    @ElementCollection
    @CollectionTable(name = "attempt_answer_selections", joinColumns = @JoinColumn(name = "answer_id"))
    @Column(name = "option_id", nullable = false)
    private Set<UUID> selectedOptionIds = new HashSet<>();

    @Column(name = "text_answer", length = 20000)
    private String textAnswer;

    private Boolean correct;

    @Column(name = "points_awarded")
    private Double pointsAwarded;

    @Column(length = 5000)
    private String feedback;

    protected AttemptAnswer() {
    }

    public static AttemptAnswer snapshotOf(Attempt attempt, Question q, int position) {
        AttemptAnswer a = new AttemptAnswer();
        a.attempt = attempt;
        a.questionId = q.getId();
        a.questionType = q.getType();
        a.prompt = q.getPrompt();
        a.explanation = q.getExplanation();
        a.points = q.getPoints();
        a.position = position;
        a.caseSensitive = q.isCaseSensitive();
        a.media = q.getMedia();
        q.getOptions().forEach(o -> a.options.add(new AnswerOptionSnapshot(o.getId(), o.getText(), o.isCorrect(),
                o.getMatchText(), o.getBlankIndex())));
        q.getAccepted().forEach(x -> a.accepted.add(new AcceptedAnswer(x.getAnswer(), x.getBlankIndex())));
        a.scoring = q.getScoring();
        a.shuffleOptions = q.isShuffleOptions();
        a.lenientSpelling = q.isLenientSpelling();
        a.maxRecordingSeconds = q.getMaxRecordingSeconds();
        return a;
    }

    public Attempt getAttempt() { return attempt; }
    public UUID getQuestionId() { return questionId; }
    public QuestionType getQuestionType() { return questionType; }
    public String getPrompt() { return prompt; }
    public String getExplanation() { return explanation; }
    public int getPoints() { return points; }
    public int getPosition() { return position; }
    public boolean isCaseSensitive() { return caseSensitive; }
    public MediaAsset getMedia() { return media; }
    public List<AnswerOptionSnapshot> getOptions() { return options; }
    public List<AcceptedAnswer> getAccepted() { return accepted; }

    /** The single list of accepted answers (blank 0) of text and dictation questions. */
    public List<String> getAcceptedAnswers() {
        return accepted.stream().filter(a -> a.getBlankIndex() == 0).map(AcceptedAnswer::getAnswer).toList();
    }

    /** CLOZE: accepted answers per blank index (ascending). */
    public Map<Integer, List<String>> getBlankAnswers() {
        Map<Integer, List<String>> byBlank = new TreeMap<>();
        accepted.stream().filter(a -> a.getBlankIndex() > 0)
                .forEach(a -> byBlank.computeIfAbsent(a.getBlankIndex(), k -> new ArrayList<>()).add(a.getAnswer()));
        return byBlank;
    }

    public Scoring getScoring() { return scoring; }
    public boolean isShuffleOptions() { return shuffleOptions; }
    public boolean isLenientSpelling() { return lenientSpelling; }
    public Integer getMaxRecordingSeconds() { return maxRecordingSeconds; }
    public String getResponseJson() { return responseJson; }
    public void setResponseJson(String responseJson) { this.responseJson = responseJson; }
    public AnswerResponse getResponse() { return AnswerResponse.parse(responseJson); }
    public MediaAsset getResponseMedia() { return responseMedia; }
    public void setResponseMedia(MediaAsset responseMedia) { this.responseMedia = responseMedia; }
    public Set<UUID> getSelectedOptionIds() { return selectedOptionIds; }
    public void setSelectedOptionIds(Set<UUID> ids) { selectedOptionIds.clear(); selectedOptionIds.addAll(ids); }
    public String getTextAnswer() { return textAnswer; }
    public void setTextAnswer(String textAnswer) { this.textAnswer = textAnswer; }
    public Boolean getCorrect() { return correct; }
    public void setCorrect(Boolean correct) { this.correct = correct; }
    public Double getPointsAwarded() { return pointsAwarded; }
    public void setPointsAwarded(Double pointsAwarded) { this.pointsAwarded = pointsAwarded; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
}
