package me.amanullah.course.assessment;

import me.amanullah.course.assessment.AssessmentDtos.BlankResult;
import me.amanullah.course.assessment.AssessmentDtos.PairResult;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Auto-grading of objective question types, with optional partial credit. Essays and spoken answers stay ungraded
 * (pending) unless left blank. Every grading method computes the fraction of the question that is right; {@code award}
 * turns it into points (all or nothing, or proportional rounded to half points).
 */
public final class Grader {

    private Grader() {
    }

    public static void grade(AttemptAnswer a) {
        switch (a.getQuestionType()) {
            case SINGLE_CHOICE, TRUE_FALSE, MULTIPLE_CHOICE -> award(a, gradeChoice(a));
            case SHORT_ANSWER, FILL_BLANK -> award(a, gradeText(a));
            case CLOZE -> award(a, gradeCloze(a));
            case WORD_BANK -> award(a, gradeWordBank(a));
            case MATCHING -> award(a, gradeMatching(a));
            case ORDERING -> award(a, gradeOrdering(a));
            case DICTATION -> award(a, gradeDictation(a));
            case ESSAY -> {
                if (a.getTextAnswer() == null || a.getTextAnswer().isBlank()) {
                    award(a, 0);
                } else {
                    a.setCorrect(null);
                    a.setPointsAwarded(null);
                }
            }
            case SPEAKING -> {
                if (a.getResponseMedia() == null) {
                    award(a, 0);
                } else {
                    a.setCorrect(null);
                    a.setPointsAwarded(null);
                }
            }
        }
    }

    // ------------------------------------------------------------------ per type: fraction of the question that is right

    static double gradeChoice(AttemptAnswer a) {
        Set<UUID> valid = a.getOptions().stream().map(AnswerOptionSnapshot::getOptionId).collect(Collectors.toSet());
        Set<UUID> selected = new HashSet<>(a.getSelectedOptionIds());
        selected.retainAll(valid);
        Set<UUID> correct = a.getOptions().stream().filter(AnswerOptionSnapshot::isCorrect)
                .map(AnswerOptionSnapshot::getOptionId).collect(Collectors.toSet());
        if (selected.isEmpty() || correct.isEmpty()) {
            return 0;
        }
        if (selected.equals(correct)) {
            return 1;
        }
        if (a.getQuestionType() != QuestionType.MULTIPLE_CHOICE) {
            return 0;
        }
        long right = selected.stream().filter(correct::contains).count();
        long wrong = selected.size() - right;
        return Math.max(0, (right - wrong) / (double) correct.size());
    }

    static double gradeText(AttemptAnswer a) {
        String given = normalizeText(a.getTextAnswer(), a);
        return !given.isEmpty() && a.getAcceptedAnswers().stream().anyMatch(acc -> normalizeText(acc, a).equals(given))
                ? 1 : 0;
    }

    static double gradeCloze(AttemptAnswer a) {
        return ratio(blankResults(a));
    }

    static double gradeWordBank(AttemptAnswer a) {
        return ratio(blankResults(a));
    }

    static double gradeMatching(AttemptAnswer a) {
        return ratio(pairResults(a));
    }

    private static double ratio(List<?> results) {
        if (results.isEmpty()) {
            return 0;
        }
        long right = results.stream().filter(r -> r instanceof BlankResult b ? b.correct() : ((PairResult) r).correct()).count();
        return right / (double) results.size();
    }

    /** CLOZE and WORD_BANK: one result per blank of the snapshot, in blank order. */
    public static List<BlankResult> blankResults(AttemptAnswer a) {
        Map<String, String> given = a.getResponse().blanks();
        List<BlankResult> out = new ArrayList<>();
        if (a.getQuestionType() == QuestionType.CLOZE) {
            for (Map.Entry<Integer, List<String>> e : a.getBlankAnswers().entrySet()) {
                String text = given.get(String.valueOf(e.getKey()));
                String g = normalizeText(text, a);
                boolean ok = !g.isEmpty() && e.getValue().stream().anyMatch(acc -> normalizeText(acc, a).equals(g));
                out.add(new BlankResult(e.getKey(), text == null || text.isBlank() ? null : text.strip(), ok,
                        List.copyOf(e.getValue())));
            }
            return out;
        }
        Map<Integer, List<String>> expected = new TreeMap<>();
        for (AnswerOptionSnapshot o : a.getOptions()) {
            if (o.getBlankIndex() != null) {
                expected.computeIfAbsent(o.getBlankIndex(), k -> new ArrayList<>()).add(o.getText());
            }
        }
        Map<String, AnswerOptionSnapshot> byId = new HashMap<>();
        a.getOptions().forEach(o -> byId.put(o.getOptionId().toString(), o));
        Set<String> used = new HashSet<>();
        for (Map.Entry<Integer, List<String>> e : expected.entrySet()) {
            String chipId = given.get(String.valueOf(e.getKey()));
            AnswerOptionSnapshot chip = chipId == null ? null : byId.get(chipId);
            boolean ok = chip != null && !used.contains(chipId)
                    && (Integer.valueOf(e.getKey()).equals(chip.getBlankIndex())
                    || e.getValue().stream().anyMatch(t -> normalizeText(t, a).equals(normalizeText(chip.getText(), a))));
            if (ok) {
                used.add(chipId);
            }
            out.add(new BlankResult(e.getKey(), chip == null ? null : chip.getText(), ok, List.copyOf(e.getValue())));
        }
        return out;
    }

    /** MATCHING: one result per left item, in authored order. */
    public static List<PairResult> pairResults(AttemptAnswer a) {
        Map<String, AnswerOptionSnapshot> byId = new HashMap<>();
        a.getOptions().forEach(o -> byId.put(o.getOptionId().toString(), o));
        Map<String, String> pairs = a.getResponse().pairs();
        Set<String> usedRights = new HashSet<>();
        List<PairResult> out = new ArrayList<>();
        for (AnswerOptionSnapshot left : a.getOptions()) {
            String rightId = pairs.get(left.getOptionId().toString());
            AnswerOptionSnapshot chosen = rightId == null ? null : byId.get(rightId);
            String expected = normalizeText(left.getMatchText(), a);
            boolean ok = chosen != null && !expected.isEmpty() && !usedRights.contains(rightId)
                    && normalizeText(chosen.getMatchText(), a).equals(expected);
            if (ok) {
                usedRights.add(rightId);
            }
            out.add(new PairResult(left.getOptionId(), left.getText(), chosen == null ? null : chosen.getOptionId(),
                    chosen == null ? null : chosen.getMatchText(), ok, left.getMatchText()));
        }
        return out;
    }

    static double gradeOrdering(AttemptAnswer a) {
        List<String> canonical = a.getOptions().stream().map(o -> o.getOptionId().toString()).toList();
        if (canonical.size() < 1) {
            return 0;
        }
        Set<String> valid = new HashSet<>(canonical);
        Set<String> seen = new HashSet<>();
        List<String> given = new ArrayList<>();
        for (String id : a.getResponse().order()) {
            if (valid.contains(id) && seen.add(id)) {
                given.add(id);
            }
        }
        if (given.isEmpty()) {
            return 0;
        }
        if (given.equals(canonical)) {
            return 1;
        }
        return TextSimilarity.lcsLength(given, canonical) / (double) canonical.size();
    }

    static double gradeDictation(AttemptAnswer a) {
        List<String> given = TextSimilarity.tokens(a.getTextAnswer(), a.isCaseSensitive(), a.isLenientSpelling());
        if (given.isEmpty()) {
            return 0;
        }
        double best = 0;
        for (String reference : a.getAcceptedAnswers()) {
            List<String> ref = TextSimilarity.tokens(reference, a.isCaseSensitive(), a.isLenientSpelling());
            if (ref.isEmpty()) {
                continue;
            }
            int errors = TextSimilarity.editDistance(given, ref);
            best = Math.max(best, errors == 0 ? 1 : Math.max(0, 1 - errors / (double) ref.size()));
        }
        return best;
    }

    // ------------------------------------------------------------------ points

    /** Awards points for the right fraction of the question; the answer is "correct" only when the fraction is 1. */
    static void award(AttemptAnswer a, double fraction) {
        boolean full = fraction >= 1.0 - 1e-9;
        a.setCorrect(full);
        a.setPointsAwarded(full ? (double) a.getPoints() : partialPoints(a, fraction));
    }

    private static double partialPoints(AttemptAnswer a, double fraction) {
        if (a.getScoring() != Scoring.PARTIAL || fraction <= 0 || a.getPoints() <= 0) {
            return 0.0;
        }
        double points = Math.round(a.getPoints() * fraction * 2) / 2.0;
        // a partly right answer never earns the full points
        return Math.min(points, Math.max(0, a.getPoints() - 0.5));
    }

    /** Normalizes typed text for comparison according to the answer's case and spelling settings. */
    static String normalizeText(String s, AttemptAnswer a) {
        return TextSimilarity.normalize(s, a.isCaseSensitive(), a.isLenientSpelling());
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
