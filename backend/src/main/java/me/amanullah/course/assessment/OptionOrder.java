package me.amanullah.course.assessment;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Display order of the options of an attempt answer. The order is a pure function of the answer row (a seeded shuffle),
 * so it stays identical across reloads, resumes and devices without storing it, and the snapshot keeps the
 * authored order that ORDERING and MATCHING are graded against.
 */
public final class OptionOrder {

    private OptionOrder() {
    }

    /** Options as the learner sees them (left side for MATCHING). */
    public static List<AnswerOptionSnapshot> display(AttemptAnswer a) {
        List<AnswerOptionSnapshot> list = new ArrayList<>(a.getOptions());
        QuestionType type = a.getQuestionType();
        boolean shuffle = type == QuestionType.ORDERING
                || (a.isShuffleOptions() && type.supportsShuffle());
        if (shuffle) {
            shuffled(list, seed(a, 1));
        }
        return list;
    }

    /** MATCHING: the right-hand texts in a stable shuffled order that differs from the left order when possible. */
    public static List<AnswerOptionSnapshot> matchTargets(AttemptAnswer a) {
        List<AnswerOptionSnapshot> left = display(a);
        List<AnswerOptionSnapshot> right = new ArrayList<>(a.getOptions());
        shuffled(right, seed(a, 2));
        if (right.size() > 1 && sameOrder(left, right)) {
            Collections.rotate(right, 1);
        }
        return right;
    }

    private static void shuffled(List<AnswerOptionSnapshot> list, long seed) {
        if (list.size() < 2) {
            return;
        }
        List<AnswerOptionSnapshot> original = new ArrayList<>(list);
        Collections.shuffle(list, new Random(seed));
        if (sameOrder(original, list)) {
            Collections.rotate(list, 1);
        }
    }

    private static boolean sameOrder(List<AnswerOptionSnapshot> a, List<AnswerOptionSnapshot> b) {
        for (int i = 0; i < a.size(); i++) {
            if (!a.get(i).getOptionId().equals(b.get(i).getOptionId())) {
                return false;
            }
        }
        return true;
    }

    private static long seed(AttemptAnswer a, int salt) {
        UUID id = a.getId() != null ? a.getId() : a.getQuestionId();
        return id.getMostSignificantBits() * 31 + id.getLeastSignificantBits() + salt * 0x9E3779B97F4A7C15L;
    }
}
