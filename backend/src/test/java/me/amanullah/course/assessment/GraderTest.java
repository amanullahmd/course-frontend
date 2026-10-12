package me.amanullah.course.assessment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class GraderTest {

    // ------------------------------------------------------------------ helpers

    private static Question question(QuestionType type, int points, Scoring scoring) {
        Question q = new Question(null);
        q.setType(type);
        q.setPrompt("p");
        q.setPoints(points);
        q.setScoring(scoring);
        return q;
    }

    private static QuestionOption option(Question q, String text, String matchText, Integer blank, boolean correct) {
        QuestionOption o = new QuestionOption(q);
        ReflectionTestUtils.setField(o, "id", UUID.randomUUID());
        o.setText(text);
        o.setMatchText(matchText);
        o.setBlankIndex(blank);
        o.setCorrect(correct);
        o.setPosition(q.getOptions().size());
        q.getOptions().add(o);
        return o;
    }

    private static AttemptAnswer answer(Question q) {
        return AttemptAnswer.snapshotOf(null, q, 0);
    }

    private static String id(AttemptAnswer a, int index) {
        return a.getOptions().get(index).getOptionId().toString();
    }

    private static void respond(AttemptAnswer a, Map<String, String> blanks, Map<String, String> pairs, List<String> order) {
        a.setResponseJson(new AnswerResponse(blanks, pairs, order).toJson());
    }

    private static void typed(AttemptAnswer a, String text) {
        a.setTextAnswer(text);
    }

    // ------------------------------------------------------------------ existing behaviour

    @Test
    void normalizeTrimsCollapsesAndLowercases() {
        assertThat(Grader.normalize("  Ich   BIN\tLuca ", false)).isEqualTo("ich bin luca");
        assertThat(Grader.normalize("  Ich   BIN ", true)).isEqualTo("Ich BIN");
        assertThat(Grader.normalize(null, false)).isEmpty();
    }

    @Test
    void percentIsRoundedToOneDecimal() {
        assertThat(Grader.percent(2.0, 3.0)).isEqualTo(66.7);
        assertThat(Grader.percent(0.0, 0.0)).isEqualTo(100.0);
        assertThat(Grader.percent(null, 5.0)).isNull();
    }

    @Test
    void singleChoiceIsAllOrNothing() {
        Question q = question(QuestionType.SINGLE_CHOICE, 2, Scoring.ALL_OR_NOTHING);
        option(q, "bin", null, null, true);
        option(q, "ist", null, null, false);
        AttemptAnswer right = answer(q);
        right.setSelectedOptionIds(java.util.Set.of(right.getOptions().get(0).getOptionId()));
        Grader.grade(right);
        assertThat(right.getCorrect()).isTrue();
        assertThat(right.getPointsAwarded()).isEqualTo(2.0);
        AttemptAnswer wrong = answer(q);
        wrong.setSelectedOptionIds(java.util.Set.of(wrong.getOptions().get(1).getOptionId()));
        Grader.grade(wrong);
        assertThat(wrong.getCorrect()).isFalse();
        assertThat(wrong.getPointsAwarded()).isZero();
        AttemptAnswer none = answer(q);
        Grader.grade(none);
        assertThat(none.getPointsAwarded()).isZero();
    }

    // ------------------------------------------------------------------ MULTIPLE_CHOICE partial credit

    @Test
    void multipleChoicePartialCreditSubtractsWrongSelections() {
        Question q = question(QuestionType.MULTIPLE_CHOICE, 4, Scoring.PARTIAL);
        option(q, "a", null, null, true);
        option(q, "b", null, null, true);
        option(q, "c", null, null, false);
        option(q, "d", null, null, false);

        AttemptAnswer oneOfTwo = answer(q);
        oneOfTwo.setSelectedOptionIds(java.util.Set.of(oneOfTwo.getOptions().get(0).getOptionId()));
        Grader.grade(oneOfTwo);
        assertThat(oneOfTwo.getPointsAwarded()).isEqualTo(2.0);
        assertThat(oneOfTwo.getCorrect()).isFalse();

        AttemptAnswer oneRightOneWrong = answer(q);
        oneRightOneWrong.setSelectedOptionIds(java.util.Set.of(oneRightOneWrong.getOptions().get(0).getOptionId(),
                oneRightOneWrong.getOptions().get(2).getOptionId()));
        Grader.grade(oneRightOneWrong);
        assertThat(oneRightOneWrong.getPointsAwarded()).isZero();

        AttemptAnswer allWrong = answer(q);
        allWrong.setSelectedOptionIds(java.util.Set.of(allWrong.getOptions().get(2).getOptionId(),
                allWrong.getOptions().get(3).getOptionId()));
        Grader.grade(allWrong);
        assertThat(allWrong.getPointsAwarded()).isZero();

        AttemptAnswer full = answer(q);
        full.setSelectedOptionIds(java.util.Set.of(full.getOptions().get(0).getOptionId(), full.getOptions().get(1).getOptionId()));
        Grader.grade(full);
        assertThat(full.getCorrect()).isTrue();
        assertThat(full.getPointsAwarded()).isEqualTo(4.0);
    }

    @Test
    void multipleChoiceAllOrNothingGivesNoPartialCredit() {
        Question q = question(QuestionType.MULTIPLE_CHOICE, 4, Scoring.ALL_OR_NOTHING);
        option(q, "a", null, null, true);
        option(q, "b", null, null, true);
        AttemptAnswer a = answer(q);
        a.setSelectedOptionIds(java.util.Set.of(a.getOptions().get(0).getOptionId()));
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isZero();
    }

    // ------------------------------------------------------------------ CLOZE

    private static AttemptAnswer cloze(Scoring scoring, boolean lenient, boolean caseSensitive) {
        Question q = question(QuestionType.CLOZE, 4, scoring);
        q.setLenientSpelling(lenient);
        q.setCaseSensitive(caseSensitive);
        q.setBlankAnswers(Map.of(1, List.of("habe", "hab"), 2, List.of("gemacht"), 3, List.of("Mädchen")));
        return answer(q);
    }

    @Test
    void clozePartialCreditIsPerBlankRoundedToHalfPoints() {
        AttemptAnswer a = cloze(Scoring.PARTIAL, false, false);
        respond(a, Map.of("1", " HABE ", "2", "gemacht", "3", "Junge"), null, null);
        Grader.grade(a);
        // 2 of 3 blanks: 4 * 2/3 = 2.67, rounded to 2.5
        assertThat(a.getPointsAwarded()).isEqualTo(2.5);
        assertThat(a.getCorrect()).isFalse();
        assertThat(Grader.blankResults(a)).extracting(AssessmentDtos.BlankResult::correct)
                .containsExactly(true, true, false);
    }

    @Test
    void clozeAllOrNothingNeedsEveryBlank() {
        AttemptAnswer a = cloze(Scoring.ALL_OR_NOTHING, false, false);
        respond(a, Map.of("1", "hab", "2", "gemacht", "3", "mädchen"), null, null);
        Grader.grade(a);
        assertThat(a.getCorrect()).isTrue();
        assertThat(a.getPointsAwarded()).isEqualTo(4.0);
        AttemptAnswer b = cloze(Scoring.ALL_OR_NOTHING, false, false);
        respond(b, Map.of("1", "hab", "2", "gemacht"), null, null);
        Grader.grade(b);
        assertThat(b.getPointsAwarded()).isZero();
    }

    @Test
    void clozeLenientSpellingAcceptsTransliteration() {
        AttemptAnswer strict = cloze(Scoring.ALL_OR_NOTHING, false, false);
        respond(strict, Map.of("1", "habe", "2", "gemacht", "3", "Maedchen"), null, null);
        Grader.grade(strict);
        assertThat(strict.getCorrect()).isFalse();
        AttemptAnswer lenient = cloze(Scoring.ALL_OR_NOTHING, true, false);
        respond(lenient, Map.of("1", "habe", "2", "gemacht", "3", "Maedchen"), null, null);
        Grader.grade(lenient);
        assertThat(lenient.getCorrect()).isTrue();
    }

    @Test
    void clozeCaseSensitivityAndEmptyResponse() {
        AttemptAnswer a = cloze(Scoring.PARTIAL, false, true);
        respond(a, Map.of("1", "habe", "2", "Gemacht", "3", "Mädchen"), null, null);
        Grader.grade(a);
        assertThat(Grader.blankResults(a)).extracting(AssessmentDtos.BlankResult::correct)
                .containsExactly(true, false, true);
        AttemptAnswer empty = cloze(Scoring.PARTIAL, false, false);
        Grader.grade(empty);
        assertThat(empty.getPointsAwarded()).isZero();
        assertThat(empty.getCorrect()).isFalse();
    }

    // ------------------------------------------------------------------ WORD_BANK

    @Test
    void wordBankGradesByChipAndRejectsReusedChips() {
        Question q = question(QuestionType.WORD_BANK, 2, Scoring.PARTIAL);
        option(q, "fährt", null, 1, true);
        option(q, "lernt", null, 2, true);
        option(q, "fahren", null, null, false);
        AttemptAnswer a = answer(q);
        respond(a, Map.of("1", id(a, 0), "2", id(a, 2)), null, null);
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isEqualTo(1.0);
        AttemptAnswer both = answer(q);
        respond(both, Map.of("1", id(both, 0), "2", id(both, 1)), null, null);
        Grader.grade(both);
        assertThat(both.getCorrect()).isTrue();
        // unknown chip ids earn nothing
        AttemptAnswer bogus = answer(q);
        respond(bogus, Map.of("1", UUID.randomUUID().toString()), null, null);
        Grader.grade(bogus);
        assertThat(bogus.getPointsAwarded()).isZero();
    }

    @Test
    void wordBankChipWithSameTextCountsForEitherBlank() {
        Question q = question(QuestionType.WORD_BANK, 2, Scoring.ALL_OR_NOTHING);
        option(q, "der", null, 1, true);
        option(q, "der", null, 2, true);
        AttemptAnswer a = answer(q);
        // chips swapped: still right, the texts are identical
        respond(a, Map.of("1", id(a, 1), "2", id(a, 0)), null, null);
        Grader.grade(a);
        assertThat(a.getCorrect()).isTrue();
        // the same chip in both blanks is not allowed
        AttemptAnswer twice = answer(q);
        respond(twice, Map.of("1", id(twice, 0), "2", id(twice, 0)), null, null);
        Grader.grade(twice);
        assertThat(twice.getCorrect()).isFalse();
    }

    // ------------------------------------------------------------------ MATCHING

    @Test
    void matchingCountsCorrectPairsAndAllowsDuplicateRightTexts() {
        Question q = question(QuestionType.MATCHING, 4, Scoring.PARTIAL);
        option(q, "Tisch", "der", null, false);
        option(q, "Lampe", "die", null, false);
        option(q, "Zeitung", "die", null, false);
        option(q, "Kind", "das", null, false);
        AttemptAnswer a = answer(q);
        Map<String, String> pairs = new HashMap<>();
        pairs.put(id(a, 0), id(a, 0));   // Tisch -> der: right
        pairs.put(id(a, 1), id(a, 2));   // Lampe -> "die" of Zeitung: right (same text)
        pairs.put(id(a, 2), id(a, 1));   // Zeitung -> "die" of Lampe: right
        pairs.put(id(a, 3), id(a, 0));   // Kind -> der: wrong
        respond(a, null, pairs, null);
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isEqualTo(3.0);
        assertThat(Grader.pairResults(a)).extracting(AssessmentDtos.PairResult::correct)
                .containsExactly(true, true, true, false);
    }

    @Test
    void matchingRightSideCannotBeUsedTwiceAndIgnoresGarbage() {
        Question q = question(QuestionType.MATCHING, 2, Scoring.PARTIAL);
        option(q, "Tisch", "der", null, false);
        option(q, "Lampe", "die", null, false);
        AttemptAnswer a = answer(q);
        Map<String, String> pairs = new HashMap<>();
        pairs.put(id(a, 0), id(a, 0));
        pairs.put(id(a, 1), "not-an-id");
        pairs.put("also-not", id(a, 1));
        respond(a, null, pairs, null);
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isEqualTo(1.0);
        AttemptAnswer none = answer(q);
        Grader.grade(none);
        assertThat(none.getPointsAwarded()).isZero();
    }

    // ------------------------------------------------------------------ ORDERING

    @Test
    void orderingAllOrNothingNeedsTheExactOrder() {
        Question q = question(QuestionType.ORDERING, 3, Scoring.ALL_OR_NOTHING);
        for (String t : List.of("Morgen", "fahre", "ich", "weg")) {
            option(q, t, null, null, false);
        }
        AttemptAnswer ok = answer(q);
        respond(ok, null, null, List.of(id(ok, 0), id(ok, 1), id(ok, 2), id(ok, 3)));
        Grader.grade(ok);
        assertThat(ok.getCorrect()).isTrue();
        AttemptAnswer swapped = answer(q);
        respond(swapped, null, null, List.of(id(swapped, 1), id(swapped, 0), id(swapped, 2), id(swapped, 3)));
        Grader.grade(swapped);
        assertThat(swapped.getPointsAwarded()).isZero();
    }

    @Test
    void orderingPartialUsesLongestCommonSubsequence() {
        Question q = question(QuestionType.ORDERING, 4, Scoring.PARTIAL);
        for (String t : List.of("a", "b", "c", "d")) {
            option(q, t, null, null, false);
        }
        AttemptAnswer a = answer(q);
        // b a c d -> LCS "acd" or "bcd" = 3 of 4
        respond(a, null, null, List.of(id(a, 1), id(a, 0), id(a, 2), id(a, 3)));
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isEqualTo(3.0);
        AttemptAnswer reversed = answer(q);
        respond(reversed, null, null, List.of(id(reversed, 3), id(reversed, 2), id(reversed, 1), id(reversed, 0)));
        Grader.grade(reversed);
        // LCS of a reversed list is 1 of 4
        assertThat(reversed.getPointsAwarded()).isEqualTo(1.0);
        AttemptAnswer none = answer(q);
        Grader.grade(none);
        assertThat(none.getPointsAwarded()).isZero();
        // duplicates and unknown ids are ignored
        AttemptAnswer dup = answer(q);
        respond(dup, null, null, List.of(id(dup, 0), id(dup, 0), UUID.randomUUID().toString(), id(dup, 1)));
        Grader.grade(dup);
        assertThat(dup.getPointsAwarded()).isEqualTo(2.0);
    }

    @Test
    void partialCreditNeverRoundsUpToFullPoints() {
        Question q = question(QuestionType.ORDERING, 1, Scoring.PARTIAL);
        for (int i = 0; i < 10; i++) {
            option(q, "x" + i, null, null, false);
        }
        AttemptAnswer a = answer(q);
        List<String> order = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            order.add(id(a, i));
        }
        java.util.Collections.swap(order, 8, 9); // 9 of 10
        respond(a, null, null, order);
        Grader.grade(a);
        assertThat(a.getCorrect()).isFalse();
        assertThat(a.getPointsAwarded()).isEqualTo(0.5);
    }

    // ------------------------------------------------------------------ DICTATION

    private static AttemptAnswer dictation(Scoring scoring, boolean lenient, String... references) {
        Question q = question(QuestionType.DICTATION, 4, scoring);
        q.setLenientSpelling(lenient);
        q.setAcceptedAnswers(List.of(references));
        return answer(q);
    }

    @Test
    void dictationLenientSpellingFoldsUmlautsEszettCaseAndPunctuation() {
        AttemptAnswer a = dictation(Scoring.ALL_OR_NOTHING, true, "Das Mädchen trinkt gern Tee.");
        typed(a, "das maedchen trinkt gern tee");
        Grader.grade(a);
        assertThat(a.getCorrect()).isTrue();
        AttemptAnswer b = dictation(Scoring.ALL_OR_NOTHING, true, "Die Straße ist groß!");
        typed(b, "Die Strasse ist gross");
        Grader.grade(b);
        assertThat(b.getCorrect()).isTrue();
        AttemptAnswer c = dictation(Scoring.ALL_OR_NOTHING, true, "Über den Brücken");
        typed(c, "Ueber den Bruecken");
        Grader.grade(c);
        assertThat(c.getCorrect()).isTrue();
    }

    @Test
    void dictationStrictKeepsUmlautsAndPunctuation() {
        AttemptAnswer a = dictation(Scoring.ALL_OR_NOTHING, false, "Das Mädchen trinkt gern Tee.");
        typed(a, "Das Maedchen trinkt gern Tee.");
        Grader.grade(a);
        assertThat(a.getCorrect()).isFalse();
        AttemptAnswer b = dictation(Scoring.ALL_OR_NOTHING, false, "Das Mädchen trinkt gern Tee.");
        typed(b, "das mädchen trinkt gern tee.");
        Grader.grade(b);
        assertThat(b.getCorrect()).isTrue(); // case is ignored unless the question is case sensitive
        AttemptAnswer c = dictation(Scoring.ALL_OR_NOTHING, false, "Das Mädchen trinkt gern Tee.");
        typed(c, "Das Mädchen trinkt gern Tee");
        Grader.grade(c);
        assertThat(c.getCorrect()).isFalse();
    }

    @Test
    void dictationPartialCreditIsTokenLevel() {
        AttemptAnswer a = dictation(Scoring.PARTIAL, true, "Ich trinke jeden Morgen einen Kaffee");
        typed(a, "Ich trinke jeden Morgen Kaffee");   // one word missing: 1 error in 6 words
        Grader.grade(a);
        assertThat(a.getCorrect()).isFalse();
        assertThat(a.getPointsAwarded()).isEqualTo(3.5);   // 4 * 5/6 = 3.33 -> 3.5
        AttemptAnswer wrong = dictation(Scoring.PARTIAL, true, "Ich trinke Kaffee");
        typed(wrong, "Du isst Brot und Butter heute");
        Grader.grade(wrong);
        assertThat(wrong.getPointsAwarded()).isZero();
    }

    @Test
    void dictationUsesTheClosestReferenceAndHandlesEmptyInput() {
        AttemptAnswer a = dictation(Scoring.ALL_OR_NOTHING, true, "Guten Tag", "Hallo zusammen");
        typed(a, "hallo zusammen");
        Grader.grade(a);
        assertThat(a.getCorrect()).isTrue();
        AttemptAnswer empty = dictation(Scoring.PARTIAL, true, "Guten Tag");
        typed(empty, "   ");
        Grader.grade(empty);
        assertThat(empty.getPointsAwarded()).isZero();
        AttemptAnswer nothing = dictation(Scoring.PARTIAL, true, "Guten Tag");
        Grader.grade(nothing);
        assertThat(nothing.getCorrect()).isFalse();
    }

    // ------------------------------------------------------------------ SHORT_ANSWER lenient + manual types

    @Test
    void shortAnswerHonoursLenientSpelling() {
        Question q = question(QuestionType.SHORT_ANSWER, 1, Scoring.ALL_OR_NOTHING);
        q.setAcceptedAnswers(List.of("Fußball"));
        q.setLenientSpelling(true);
        AttemptAnswer a = answer(q);
        typed(a, "Fussball");
        Grader.grade(a);
        assertThat(a.getCorrect()).isTrue();
        q.setLenientSpelling(false);
        AttemptAnswer b = answer(q);
        typed(b, "Fussball");
        Grader.grade(b);
        assertThat(b.getCorrect()).isFalse();
    }

    @Test
    void speakingAndEssayStayPendingUnlessBlank() {
        Question speaking = question(QuestionType.SPEAKING, 5, Scoring.ALL_OR_NOTHING);
        AttemptAnswer none = answer(speaking);
        Grader.grade(none);
        assertThat(none.getCorrect()).isFalse();
        assertThat(none.getPointsAwarded()).isZero();

        Question essay = question(QuestionType.ESSAY, 5, Scoring.ALL_OR_NOTHING);
        AttemptAnswer written = answer(essay);
        typed(written, "Text");
        Grader.grade(written);
        assertThat(written.getPointsAwarded()).isNull();
        assertThat(written.getCorrect()).isNull();
    }

    @Test
    void allOrNothingTypesIgnoreAPartialFlagWhenNotSupported() {
        // the service never stores PARTIAL for types without partial credit, but the grader must not crash on them
        Question q = question(QuestionType.SHORT_ANSWER, 3, Scoring.PARTIAL);
        q.setAcceptedAnswers(List.of("ja"));
        AttemptAnswer a = answer(q);
        typed(a, "nein");
        Grader.grade(a);
        assertThat(a.getPointsAwarded()).isZero();
    }
}
