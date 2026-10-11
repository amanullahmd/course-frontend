package de.sprachweg.assessment;

public enum QuestionType {
    SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK, ESSAY;

    public boolean isChoice() {
        return this == SINGLE_CHOICE || this == MULTIPLE_CHOICE || this == TRUE_FALSE;
    }

    public boolean isText() {
        return this == SHORT_ANSWER || this == FILL_BLANK;
    }
}
