package me.amanullah.course.assessment;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.media.MediaAsset;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "questions")
public class Question extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "question_type", nullable = false, length = 20)
    private QuestionType type;

    @Column(nullable = false, length = 20000)
    private String prompt;

    @Column(length = 20000)
    private String explanation;

    @Column(nullable = false)
    private int points = 1;

    @Column(name = "sort_order", nullable = false)
    private int position;

    @Column(name = "case_sensitive", nullable = false)
    private boolean caseSensitive;

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

    @ElementCollection
    @CollectionTable(name = "question_accepted_answers", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "sort_order")
    private List<AcceptedAnswer> accepted = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_id")
    private MediaAsset media;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<QuestionOption> options = new ArrayList<>();

    protected Question() {
    }

    public Question(Assessment assessment) {
        this.assessment = assessment;
    }

    public Assessment getAssessment() { return assessment; }
    public QuestionType getType() { return type; }
    public void setType(QuestionType type) { this.type = type; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public boolean isCaseSensitive() { return caseSensitive; }
    public void setCaseSensitive(boolean caseSensitive) { this.caseSensitive = caseSensitive; }
    public Scoring getScoring() { return scoring; }
    public void setScoring(Scoring scoring) { this.scoring = scoring; }
    public boolean isShuffleOptions() { return shuffleOptions; }
    public void setShuffleOptions(boolean shuffleOptions) { this.shuffleOptions = shuffleOptions; }
    public boolean isLenientSpelling() { return lenientSpelling; }
    public void setLenientSpelling(boolean lenientSpelling) { this.lenientSpelling = lenientSpelling; }
    public Integer getMaxRecordingSeconds() { return maxRecordingSeconds; }
    public void setMaxRecordingSeconds(Integer maxRecordingSeconds) { this.maxRecordingSeconds = maxRecordingSeconds; }
    public List<AcceptedAnswer> getAccepted() { return accepted; }

    /** The single list of accepted answers (blank 0) of SHORT_ANSWER, FILL_BLANK and DICTATION questions. */
    public List<String> getAcceptedAnswers() {
        return accepted.stream().filter(a -> a.getBlankIndex() == 0).map(AcceptedAnswer::getAnswer).toList();
    }

    public void setAcceptedAnswers(List<String> answers) {
        accepted.clear();
        answers.forEach(a -> accepted.add(new AcceptedAnswer(a, 0)));
    }

    /** Replaces the accepted answers by the given answers per blank index (CLOZE). */
    public void setBlankAnswers(java.util.Map<Integer, List<String>> byBlank) {
        accepted.clear();
        byBlank.forEach((blank, answers) -> answers.forEach(a -> accepted.add(new AcceptedAnswer(a, blank))));
    }

    public java.util.Map<Integer, List<String>> getBlankAnswers() {
        java.util.Map<Integer, List<String>> byBlank = new java.util.TreeMap<>();
        accepted.stream().filter(a -> a.getBlankIndex() > 0)
                .forEach(a -> byBlank.computeIfAbsent(a.getBlankIndex(), k -> new ArrayList<>()).add(a.getAnswer()));
        return byBlank;
    }
    public MediaAsset getMedia() { return media; }
    public void setMedia(MediaAsset media) { this.media = media; }
    public List<QuestionOption> getOptions() { return options; }
}
