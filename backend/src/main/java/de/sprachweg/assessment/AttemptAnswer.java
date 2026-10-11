package de.sprachweg.assessment;

import de.sprachweg.common.persistence.BaseEntity;
import de.sprachweg.media.MediaAsset;
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
    @Column(name = "answer", nullable = false, length = 500)
    private List<String> acceptedAnswers = new ArrayList<>();

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
        q.getOptions().forEach(o -> a.options.add(new AnswerOptionSnapshot(o.getId(), o.getText(), o.isCorrect())));
        a.acceptedAnswers.addAll(q.getAcceptedAnswers());
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
    public List<String> getAcceptedAnswers() { return acceptedAnswers; }
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
