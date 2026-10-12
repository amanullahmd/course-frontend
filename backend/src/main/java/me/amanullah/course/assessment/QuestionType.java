package me.amanullah.course.assessment;

public enum QuestionType {
    SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK, ESSAY,
    CLOZE, WORD_BANK, MATCHING, ORDERING, DICTATION, SPEAKING;

    public boolean isChoice() {
        return this == SINGLE_CHOICE || this == MULTIPLE_CHOICE || this == TRUE_FALSE;
    }

    /** Typed single answer compared with a list of accepted answers. */
    public boolean isText() {
        return this == SHORT_ANSWER || this == FILL_BLANK;
    }

    /** Prompt with {{n}} blank markers (typed in CLOZE, picked from the word bank in WORD_BANK). */
    public boolean hasBlanks() {
        return this == CLOZE || this == WORD_BANK;
    }

    /** Types whose question options are stored and shown to the learner. */
    public boolean usesOptions() {
        return isChoice() || this == WORD_BANK || this == MATCHING || this == ORDERING;
    }

    /** Types with a reference text (accepted answers) that is shown after grading when allowed. */
    public boolean hasReferenceAnswers() {
        return isText() || this == DICTATION || this == CLOZE;
    }

    /** Graded by the instructor (stays pending until then). */
    public boolean isManual() {
        return this == ESSAY || this == SPEAKING;
    }

    /** Types for which the author can choose partial credit. */
    public boolean supportsPartialCredit() {
        return this == MULTIPLE_CHOICE || hasBlanks() || this == MATCHING || this == ORDERING || this == DICTATION;
    }

    /** Types whose answer is a typed text compared with spelling tolerance. */
    public boolean supportsLenientSpelling() {
        return isText() || this == CLOZE || this == DICTATION;
    }

    /** Types for which the options can be shuffled (ORDERING and MATCHING are always shuffled for display). */
    public boolean supportsShuffle() {
        return this == SINGLE_CHOICE || this == MULTIPLE_CHOICE || this == WORD_BANK || this == MATCHING;
    }
}
