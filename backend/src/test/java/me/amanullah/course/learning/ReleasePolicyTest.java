package me.amanullah.course.learning;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import me.amanullah.course.course.CourseProgression;
import me.amanullah.course.learning.ReleasePolicy.Context;
import me.amanullah.course.learning.ReleasePolicy.Item;
import me.amanullah.course.learning.ReleasePolicy.Module;
import me.amanullah.course.learning.ReleasePolicy.Outline;
import me.amanullah.course.learning.ReleasePolicy.Prereq;
import me.amanullah.course.learning.ReleasePolicy.Reason;
import me.amanullah.course.learning.ReleasePolicy.State;
import org.junit.jupiter.api.Test;

class ReleasePolicyTest {

    private static final Instant ANCHOR = Instant.parse("2030-01-01T00:00:00Z");

    private final Item a = item("A", true, null, null);
    private final Item b = item("B", false, null, null);
    private final Item quiz = item("Q", true, null, 60);
    private final Item c = item("C", true, null, null);
    private final Item d = item("D", true, null, null);

    private static Item item(String title, boolean required, Integer offset, Integer passing) {
        return new Item(UUID.randomUUID(), title, required, offset, passing);
    }

    private static Module module(Integer offset, Item... items) {
        return new Module(UUID.randomUUID(), offset, List.of(items));
    }

    private static Context ctx(Instant anchor, Map<UUID, Double> best, Item... completed) {
        return new Context(anchor, java.util.Arrays.stream(completed).map(Item::id).collect(java.util.stream.Collectors.toSet()),
                best);
    }

    private static Instant days(long n) {
        return ANCHOR.plus(Duration.ofDays(n));
    }

    @Test
    void freeCourseWithoutRulesIsAllAvailable() {
        Outline o = new Outline(CourseProgression.FREE, List.of(module(null, a, b), module(null, c)), Map.of());
        Map<UUID, State> s = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(0));
        assertThat(s.values()).allMatch(x -> !x.locked());
        assertThat(s).hasSize(3);
    }

    @Test
    void dripTakesTheLaterOfModuleAndItemOffset() {
        Item early = item("early", true, 2, null);
        Item late = item("late", true, 9, null);
        Module m = module(5, early, late, a);
        Outline o = new Outline(CourseProgression.FREE, List.of(m), Map.of());
        Map<UUID, State> day0 = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(0));
        assertThat(day0.get(early.id()).reason()).isEqualTo(Reason.DATE);
        assertThat(day0.get(early.id()).unlockAt()).isEqualTo(days(5));
        assertThat(day0.get(late.id()).unlockAt()).isEqualTo(days(9));
        assertThat(day0.get(a.id()).unlockAt()).isEqualTo(days(5));
        Map<UUID, State> day5 = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(5));
        assertThat(day5.get(early.id()).locked()).isFalse();
        assertThat(day5.get(a.id()).locked()).isFalse();
        assertThat(day5.get(late.id()).reason()).isEqualTo(Reason.DATE);
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(9)).get(late.id()).locked()).isFalse();
    }

    @Test
    void dripOffsetZeroIsOpenImmediately() {
        Item now = item("now", true, 0, null);
        Outline o = new Outline(CourseProgression.FREE, List.of(module(0, now)), Map.of());
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), ANCHOR).get(now.id()).locked()).isFalse();
    }

    @Test
    void prerequisitesAreAndedAndHonourMinimumScore() {
        Module m1 = module(null, a, quiz);
        Module m2 = module(null, c);
        Outline o = new Outline(CourseProgression.FREE, List.of(m1, m2),
                Map.of(c.id(), List.of(new Prereq(a.id(), null), new Prereq(quiz.id(), 80))));
        State none = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(1)).get(c.id());
        assertThat(none.reason()).isEqualTo(Reason.PREREQUISITE);
        assertThat(none.blockers()).extracting(ReleasePolicy.Blocker::title).containsExactly("A", "Q");
        State lowScore = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(quiz.id(), 70.0), a, quiz), days(1)).get(c.id());
        assertThat(lowScore.blockers()).extracting(ReleasePolicy.Blocker::title).containsExactly("Q");
        assertThat(lowScore.blockers().get(0).minPercent()).isEqualTo(80);
        State ok = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(quiz.id(), 80.0), a, quiz), days(1)).get(c.id());
        assertThat(ok.locked()).isFalse();
    }

    @Test
    void moduleAndItemPrerequisitesCombine() {
        Module m2 = module(null, c, d);
        Outline o = new Outline(CourseProgression.FREE, List.of(module(null, a, b), m2),
                Map.of(m2.id(), List.of(new Prereq(a.id(), null)), d.id(), List.of(new Prereq(b.id(), null))));
        Map<UUID, State> s = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(), a), days(1));
        assertThat(s.get(c.id()).locked()).isFalse();
        assertThat(s.get(d.id()).blockers()).extracting(ReleasePolicy.Blocker::title).containsExactly("B");
    }

    @Test
    void prerequisiteOnAnItemOutsideTheLiveOutlineIsIgnored() {
        Outline o = new Outline(CourseProgression.FREE, List.of(module(null, c)),
                Map.of(c.id(), List.of(new Prereq(UUID.randomUUID(), null))));
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(1)).get(c.id()).locked()).isFalse();
    }

    @Test
    void sequentialModulesNeedEveryRequiredItemOfEarlierModulesAndPassedAssessments() {
        Outline o = new Outline(CourseProgression.SEQUENTIAL_MODULES,
                List.of(module(null, a, b, quiz), module(null, c), module(null, d)), Map.of());
        Map<UUID, State> s0 = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(1));
        assertThat(s0.get(a.id()).locked()).isFalse();
        assertThat(s0.get(quiz.id()).locked()).isFalse();
        assertThat(s0.get(c.id()).reason()).isEqualTo(Reason.SEQUENCE);
        assertThat(s0.get(c.id()).blockers().get(0).itemId()).isEqualTo(a.id());
        assertThat(s0.get(d.id()).reason()).isEqualTo(Reason.SEQUENCE);
        // optional B is not needed; the failed quiz still blocks
        Map<UUID, State> failed = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(quiz.id(), 50.0), a, quiz), days(1));
        assertThat(failed.get(c.id()).blockers().get(0).itemId()).isEqualTo(quiz.id());
        Map<UUID, State> passed = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(quiz.id(), 60.0), a, quiz), days(1));
        assertThat(passed.get(c.id()).locked()).isFalse();
        assertThat(passed.get(d.id()).reason()).isEqualTo(Reason.SEQUENCE); // C still open
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(quiz.id(), 60.0), a, quiz, c), days(1))
                .get(d.id()).locked()).isFalse();
    }

    @Test
    void sequentialItemsFollowThePreviousRequiredItem() {
        Outline o = new Outline(CourseProgression.SEQUENTIAL_ITEMS,
                List.of(module(null, a, b), module(null, c)), Map.of());
        Map<UUID, State> s = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(1));
        assertThat(s.get(a.id()).locked()).isFalse();
        assertThat(s.get(b.id()).blockers().get(0).itemId()).isEqualTo(a.id());
        assertThat(s.get(c.id()).blockers().get(0).itemId()).isEqualTo(a.id()); // B is optional
        Map<UUID, State> done = ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of(), a), days(1));
        assertThat(done.values()).allMatch(x -> !x.locked());
    }

    @Test
    void reasonPriorityIsDateThenPrerequisiteThenSequence() {
        Item dated = item("dated", true, 3, null);
        Module m = module(null, a, dated);
        Outline o = new Outline(CourseProgression.SEQUENTIAL_ITEMS, List.of(m),
                Map.of(dated.id(), List.of(new Prereq(a.id(), null))));
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(1)).get(dated.id()).reason())
                .isEqualTo(Reason.DATE);
        assertThat(ReleasePolicy.evaluate(o, ctx(ANCHOR, Map.of()), days(4)).get(dated.id()).reason())
                .isEqualTo(Reason.PREREQUISITE);
    }

    @Test
    void previewNeverLocks() {
        Item dated = item("dated", true, 30, null);
        Outline o = new Outline(CourseProgression.SEQUENTIAL_ITEMS, List.of(module(5, a, dated)),
                Map.of(dated.id(), List.of(new Prereq(a.id(), null))));
        assertThat(ReleasePolicy.evaluate(o, ctx(null, Map.of()), days(0)).values()).allMatch(x -> !x.locked());
    }

    @Test
    void emptyOutlineIsFine() {
        assertThat(ReleasePolicy.evaluate(new Outline(CourseProgression.FREE, List.of(), Map.of()),
                new Context(ANCHOR, Set.of(), Map.of()), days(0))).isEmpty();
    }
}
