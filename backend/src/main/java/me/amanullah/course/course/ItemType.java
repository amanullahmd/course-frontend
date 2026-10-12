package me.amanullah.course.course;

public enum ItemType {
    TEXT, DOCUMENT, VIDEO, AUDIO, IMAGE, EMBED, QUIZ, EXAM, FLASHCARDS, ASSIGNMENT;

    public boolean isAssessment() {
        return this == QUIZ || this == EXAM;
    }
}
