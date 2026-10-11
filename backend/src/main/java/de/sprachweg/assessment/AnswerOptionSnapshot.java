package de.sprachweg.assessment;

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

    protected AnswerOptionSnapshot() {
    }

    public AnswerOptionSnapshot(UUID optionId, String text, boolean correct) {
        this.optionId = optionId;
        this.text = text;
        this.correct = correct;
    }

    public UUID getOptionId() { return optionId; }
    public String getText() { return text; }
    public boolean isCorrect() { return correct; }
}
