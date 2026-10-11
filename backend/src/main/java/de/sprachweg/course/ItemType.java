package de.sprachweg.course;

public enum ItemType {
    TEXT, DOCUMENT, VIDEO, AUDIO, IMAGE, EMBED, QUIZ, EXAM;

    public boolean isAssessment() {
        return this == QUIZ || this == EXAM;
    }
}
