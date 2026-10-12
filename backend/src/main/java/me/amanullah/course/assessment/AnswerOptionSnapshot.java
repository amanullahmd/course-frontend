package me.amanullah.course.assessment;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.UUID;

/** Copy of a question option at the time the attempt was started. */
@Embeddable
public class AnswerOptionSnapshot {

    @Column(name = "option_id", nullable = false)
    private UUID optionId;

    @Column(name = "option_text", nullable = false, length = 2000)
    private String text;

    @Column(nullable = false)
    private boolean correct;

    @Column(name = "match_text", length = 2000)
    private String matchText;

    @Column(name = "blank_index")
    private Integer blankIndex;

    protected AnswerOptionSnapshot() {
    }

    public AnswerOptionSnapshot(UUID optionId, String text, boolean correct) {
        this(optionId, text, correct, null, null);
    }

    public AnswerOptionSnapshot(UUID optionId, String text, boolean correct, String matchText, Integer blankIndex) {
        this.optionId = optionId;
        this.text = text;
        this.correct = correct;
        this.matchText = matchText;
        this.blankIndex = blankIndex;
    }

    public UUID getOptionId() { return optionId; }
    public String getText() { return text; }
    public boolean isCorrect() { return correct; }
    public String getMatchText() { return matchText; }
    public Integer getBlankIndex() { return blankIndex; }
}
