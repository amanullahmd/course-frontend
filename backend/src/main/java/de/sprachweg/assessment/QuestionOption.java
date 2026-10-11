package de.sprachweg.assessment;

import de.sprachweg.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "question_options")
public class QuestionOption extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "option_text", nullable = false, length = 2000)
    private String text;

    @Column(nullable = false)
    private boolean correct;

    @Column(name = "sort_order", nullable = false)
    private int position;

    protected QuestionOption() {
    }

    public QuestionOption(Question question) {
        this.question = question;
    }

    public Question getQuestion() { return question; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
