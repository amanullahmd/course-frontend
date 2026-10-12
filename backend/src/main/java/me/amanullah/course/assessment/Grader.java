package me.amanullah.course.assessment;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Auto-grading of objective question types. Essays stay ungraded (pending) unless left blank. */
public final class Grader {

    private Grader() {
    }

    public static void grade(AttemptAnswer a) {
        switch (a.getQuestionType()) {
            case SINGLE_CHOICE, TRUE_FALSE, MULTIPLE_CHOICE -> {
                Set<UUID> valid = a.getOptions().stream().map(AnswerOptionSnapshot::getOptionId).collect(Collectors.toSet());
                Set<UUID> selected = new HashSet<>(a.getSelectedOptionIds());
                selected.retainAll(valid);
                Set<UUID> correct = a.getOptions().stream().filter(AnswerOptionSnapshot::isCorrect)
                        .map(AnswerOptionSnapshot::getOptionId).collect(Collectors.toSet());
                boolean ok = !selected.isEmpty() && selected.equals(correct);
                award(a, ok);
            }
            case SHORT_ANSWER, FILL_BLANK -> {
                String given = normalize(a.getTextAnswer(), a.isCaseSensitive());
                boolean ok = !given.isEmpty() && a.getAcceptedAnswers().stream()
                        .anyMatch(acc -> normalize(acc, a.isCaseSensitive()).equals(given));
                award(a, ok);
            }
            case ESSAY -> {
                if (a.getTextAnswer() == null || a.getTextAnswer().isBlank()) {
                    award(a, false);
                } else {
                    a.setCorrect(null);
                    a.setPointsAwarded(null);
                }
            }
        }
    }

    private static void award(AttemptAnswer a, boolean ok) {
        a.setCorrect(ok);
        a.setPointsAwarded(ok ? (double) a.getPoints() : 0.0);
    }

    /** Trims, collapses whitespace and lower-cases unless case sensitive. */
    public static String normalize(String s, boolean caseSensitive) {
        if (s == null) {
            return "";
        }
        String n = s.strip().replaceAll("\\s+", " ");
        return caseSensitive ? n : n.toLowerCase(Locale.ROOT);
    }

    public static Double percent(Double score, double maxScore) {
        if (score == null) {
            return null;
        }
        if (maxScore <= 0) {
            return 100.0;
        }
        return Math.round(score / maxScore * 1000.0) / 10.0;
    }
}
