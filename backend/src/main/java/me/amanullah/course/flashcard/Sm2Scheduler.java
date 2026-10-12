package me.amanullah.course.flashcard;

import java.time.Duration;
import java.time.Instant;

/**
 * Pure SM-2 style scheduler (no I/O, unit tested).
 *
 * <ul>
 *   <li>AGAIN: repetitions reset to 0, one lapse, ease -0.20, due again after the 10 minute learning step; the next
 *       success starts over at 1 day.</li>
 *   <li>HARD: ease -0.15; interval x1.2 (at least one day more than before).</li>
 *   <li>GOOD: ease unchanged; interval x ease.</li>
 *   <li>EASY: ease +0.15; interval x ease x1.3.</li>
 *   <li>The first two successful reviews use fixed steps (HARD/GOOD/EASY: 1/1/3 days, then 3/6/7 days).</li>
 *   <li>Ease never drops below 1.3; intervals are capped at 10 years.</li>
 * </ul>
 */
public final class Sm2Scheduler {

    public static final double INITIAL_EASE = 2.5;
    public static final double MIN_EASE = 1.3;
    public static final int MAX_INTERVAL_DAYS = 3650;
    public static final Duration LEARNING_STEP = Duration.ofMinutes(10);

    private Sm2Scheduler() {
    }

    public record State(int repetitions, int intervalDays, double ease, int lapses, Instant dueAt) {
    }

    /** State of a card that was never reviewed. */
    public static State initial(Instant now) {
        return new State(0, 0, INITIAL_EASE, 0, now);
    }

    public static State next(State s, Grade grade, Instant now) {
        if (grade == Grade.AGAIN) {
            return new State(0, 1, clamp(s.ease() - 0.20), s.lapses() + 1, now.plus(LEARNING_STEP));
        }
        double ease = clamp(switch (grade) {
            case HARD -> s.ease() - 0.15;
            case EASY -> s.ease() + 0.15;
            default -> s.ease();
        });
        int prev = Math.max(1, s.intervalDays());
        int days;
        if (s.repetitions() == 0) {
            days = switch (grade) {
                case HARD, GOOD -> 1;
                default -> 3;
            };
        } else if (s.repetitions() == 1) {
            days = switch (grade) {
                case HARD -> 3;
                case GOOD -> 6;
                default -> 7;
            };
        } else {
            double raw = switch (grade) {
                case HARD -> prev * 1.2;
                case GOOD -> prev * ease;
                default -> prev * ease * 1.3;
            };
            days = Math.max(prev + 1, (int) Math.round(raw));
        }
        days = Math.min(days, MAX_INTERVAL_DAYS);
        return new State(s.repetitions() + 1, days, ease, s.lapses(), now.plus(Duration.ofDays(days)));
    }

    private static double clamp(double ease) {
        return Math.max(MIN_EASE, Math.round(ease * 100.0) / 100.0);
    }
}
