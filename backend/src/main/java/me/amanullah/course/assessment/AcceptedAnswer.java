package me.amanullah.course.assessment;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** An accepted answer for blank {@code blankIndex} (0 for questions without numbered blanks). */
@Embeddable
public class AcceptedAnswer {

    @Column(name = "answer", nullable = false, length = 500)
    private String answer;

    @Column(name = "blank_index", nullable = false)
    private int blankIndex;

    protected AcceptedAnswer() {
    }

    public AcceptedAnswer(String answer, int blankIndex) {
        this.answer = answer;
        this.blankIndex = blankIndex;
    }

    public String getAnswer() { return answer; }
    public int getBlankIndex() { return blankIndex; }
}
