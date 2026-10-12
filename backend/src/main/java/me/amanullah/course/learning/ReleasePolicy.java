package me.amanullah.course.learning;

import me.amanullah.course.course.CourseProgression;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Pure release rules: which live items of a course are open for a learner right now. No I/O, easy to test.
 * <ul>
 *   <li><b>Drip</b>: a module/item opens {@code offsetDays} after the learner's enrollment was approved (the anchor);
 *       the later of module and item date counts.</li>
 *   <li><b>Prerequisites</b> (module and item level, AND): the required item is completed, and when a minimum score is
 *       set, the best graded attempt reaches it. Prerequisites on items that are not part of the (live) outline are
 *       ignored so that unpublishing an item can never lock learners out forever.</li>
 *   <li><b>Progression</b>: SEQUENTIAL_MODULES needs every required item of the earlier modules done,
 *       SEQUENTIAL_ITEMS the previous required item. "Done" means completed and, for assessments with a passing score,
 *       passed. Optional items never gate anybody.</li>
 * </ul>
 * If several rules apply, the reason is chosen as DATE, then PREREQUISITE, then SEQUENCE.
 */
public final class ReleasePolicy {

    private ReleasePolicy() {
    }

    public enum Reason { DATE, PREREQUISITE, SEQUENCE }

    public record Item(UUID id, String title, boolean required, Integer offsetDays, Integer passingScore) {
    }

    public record Module(UUID id, Integer offsetDays, List<Item> items) {
    }

    public record Prereq(UUID itemId, Integer minPercent) {
    }

    /** Live outline in display order plus the explicit prerequisites keyed by module or item id. */
    public record Outline(CourseProgression progression, List<Module> modules, Map<UUID, List<Prereq>> prerequisites) {
    }

    /** {@code anchor == null} means preview (instructor/admin): nothing is locked. */
    public record Context(Instant anchor, Set<UUID> completed, Map<UUID, Double> bestPercent) {
    }

    public record Blocker(UUID itemId, String title, Integer minPercent) {
    }

    public record State(Reason reason, Instant unlockAt, List<Blocker> blockers) {
        public static final State AVAILABLE = new State(null, null, List.of());

        public boolean locked() {
            return reason != null;
        }
    }

    public static Map<UUID, State> evaluate(Outline outline, Context ctx, Instant now) {
        Map<UUID, State> result = new LinkedHashMap<>();
        Map<UUID, Item> byId = new HashMap<>();
        outline.modules().forEach(m -> m.items().forEach(i -> byId.put(i.id(), i)));
        if (ctx.anchor() == null) {
            byId.keySet().forEach(id -> result.put(id, State.AVAILABLE));
            return result;
        }
        // "done" per required item, in order, for the sequential modes
        List<Item> requiredSoFar = new ArrayList<>();
        Item previousRequired = null;
        for (Module m : outline.modules()) {
            Blocker moduleGate = null;
            if (outline.progression() == CourseProgression.SEQUENTIAL_MODULES) {
                for (Item r : requiredSoFar) {
                    if (!done(r, ctx)) {
                        moduleGate = new Blocker(r.id(), r.title(), r.passingScore());
                        break;
                    }
                }
            }
            for (Item item : m.items()) {
                Instant unlockAt = latest(open(ctx.anchor(), m.offsetDays()), open(ctx.anchor(), item.offsetDays()));
                List<Blocker> unmet = new ArrayList<>();
                addUnmet(unmet, outline.prerequisites().get(m.id()), byId, ctx);
                addUnmet(unmet, outline.prerequisites().get(item.id()), byId, ctx);
                Blocker sequence = moduleGate;
                if (outline.progression() == CourseProgression.SEQUENTIAL_ITEMS && previousRequired != null
                        && !done(previousRequired, ctx)) {
                    sequence = new Blocker(previousRequired.id(), previousRequired.title(), previousRequired.passingScore());
                }
                if (unlockAt != null && unlockAt.isAfter(now)) {
                    result.put(item.id(), new State(Reason.DATE, unlockAt, List.of()));
                } else if (!unmet.isEmpty()) {
                    result.put(item.id(), new State(Reason.PREREQUISITE, null, List.copyOf(unmet)));
                } else if (sequence != null) {
                    result.put(item.id(), new State(Reason.SEQUENCE, null, List.of(sequence)));
                } else {
                    result.put(item.id(), State.AVAILABLE);
                }
                if (item.required()) {
                    previousRequired = item;
                }
            }
            m.items().stream().filter(Item::required).forEach(requiredSoFar::add);
        }
        return result;
    }

    private static void addUnmet(List<Blocker> unmet, List<Prereq> rules, Map<UUID, Item> byId, Context ctx) {
        if (rules == null) {
            return;
        }
        for (Prereq p : rules) {
            Item required = byId.get(p.itemId());
            if (required == null) {
                continue; // not live: ignored
            }
            boolean ok = ctx.completed().contains(p.itemId());
            if (ok && p.minPercent() != null) {
                Double best = ctx.bestPercent().get(p.itemId());
                ok = best != null && best >= p.minPercent();
            }
            if (!ok && unmet.stream().noneMatch(b -> b.itemId().equals(p.itemId()))) {
                unmet.add(new Blocker(required.id(), required.title(), p.minPercent()));
            }
        }
    }

    private static boolean done(Item item, Context ctx) {
        if (!ctx.completed().contains(item.id())) {
            return false;
        }
        if (item.passingScore() == null) {
            return true;
        }
        Double best = ctx.bestPercent().get(item.id());
        return best != null && best >= item.passingScore();
    }

    private static Instant open(Instant anchor, Integer days) {
        return days == null ? null : anchor.plus(Duration.ofDays(days));
    }

    private static Instant latest(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        return b == null || a.isAfter(b) ? a : b;
    }
}
