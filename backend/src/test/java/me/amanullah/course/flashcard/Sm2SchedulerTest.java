package me.amanullah.course.flashcard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import me.amanullah.course.flashcard.Sm2Scheduler.State;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class Sm2SchedulerTest {

    private static final Instant NOW = Instant.parse("2026-10-12T08:00:00Z");

    private static State after(State s, Grade... grades) {
        for (Grade g : grades) {
            s = Sm2Scheduler.next(s, g, NOW);
        }
        return s;
    }

    @Test
    void firstSuccessesUseFixedSteps() {
        State fresh = Sm2Scheduler.initial(NOW);
        assertThat(Sm2Scheduler.next(fresh, Grade.GOOD, NOW).intervalDays()).isEqualTo(1);
        assertThat(Sm2Scheduler.next(fresh, Grade.HARD, NOW).intervalDays()).isEqualTo(1);
        assertThat(Sm2Scheduler.next(fresh, Grade.EASY, NOW).intervalDays()).isEqualTo(3);
        State good = after(fresh, Grade.GOOD, Grade.GOOD);
        assertThat(good.intervalDays()).isEqualTo(6);
        assertThat(good.repetitions()).isEqualTo(2);
        assertThat(after(fresh, Grade.GOOD, Grade.HARD).intervalDays()).isEqualTo(3);
        assertThat(after(fresh, Grade.GOOD, Grade.EASY).intervalDays()).isEqualTo(7);
        assertThat(good.dueAt()).isEqualTo(NOW.plus(Duration.ofDays(6)));
    }

    @Test
    void laterIntervalsMultiplyByEaseHardAndEasy() {
        State s = after(Sm2Scheduler.initial(NOW), Grade.GOOD, Grade.GOOD); // 6 days, ease 2.5
        assertThat(Sm2Scheduler.next(s, Grade.GOOD, NOW).intervalDays()).isEqualTo(15);
        // HARD: x1.2 (at least one day more), ease -0.15
        State hard = Sm2Scheduler.next(s, Grade.HARD, NOW);
        assertThat(hard.intervalDays()).isEqualTo(7);
        assertThat(hard.ease()).isCloseTo(2.35, within(1e-9));
        // EASY: x ease x1.3 with ease +0.15 = 2.65 -> 6 * 2.65 * 1.3 = 20.67
        State easy = Sm2Scheduler.next(s, Grade.EASY, NOW);
        assertThat(easy.intervalDays()).isEqualTo(21);
        assertThat(easy.ease()).isCloseTo(2.65, within(1e-9));
        // the interval always grows by at least one day
        State tiny = new State(5, 1, 1.3, 0, NOW);
        assertThat(Sm2Scheduler.next(tiny, Grade.HARD, NOW).intervalDays()).isEqualTo(2);
    }

    @Test
    void againResetsRepetitionsCountsALapseAndRetriesInTenMinutes() {
        State s = after(Sm2Scheduler.initial(NOW), Grade.GOOD, Grade.GOOD, Grade.GOOD);
        State lapsed = Sm2Scheduler.next(s, Grade.AGAIN, NOW);
        assertThat(lapsed.repetitions()).isZero();
        assertThat(lapsed.lapses()).isEqualTo(1);
        assertThat(lapsed.intervalDays()).isEqualTo(1);
        assertThat(lapsed.ease()).isCloseTo(2.3, within(1e-9));
        assertThat(lapsed.dueAt()).isEqualTo(NOW.plus(Duration.ofMinutes(10)));
        // the way back starts at one day again
        assertThat(Sm2Scheduler.next(lapsed, Grade.GOOD, NOW).intervalDays()).isEqualTo(1);
    }

    @Test
    void easeNeverDropsBelowTheMinimum() {
        State s = Sm2Scheduler.initial(NOW);
        for (int i = 0; i < 30; i++) {
            s = Sm2Scheduler.next(s, Grade.AGAIN, NOW);
        }
        assertThat(s.ease()).isEqualTo(Sm2Scheduler.MIN_EASE);
        assertThat(s.lapses()).isEqualTo(30);
        State h = Sm2Scheduler.initial(NOW);
        for (int i = 0; i < 30; i++) {
            h = Sm2Scheduler.next(h, Grade.HARD, NOW);
        }
        assertThat(h.ease()).isEqualTo(Sm2Scheduler.MIN_EASE);
    }

    @Test
    void intervalsAreCapped() {
        State s = new State(10, 3000, 3.0, 0, NOW);
        assertThat(Sm2Scheduler.next(s, Grade.EASY, NOW).intervalDays()).isEqualTo(Sm2Scheduler.MAX_INTERVAL_DAYS);
    }
}
