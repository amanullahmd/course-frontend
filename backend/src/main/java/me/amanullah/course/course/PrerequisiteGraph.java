package me.amanullah.course.course;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Cycle detection for prerequisites ("item A needs item B" edges, module rules expanded onto their items). */
public final class PrerequisiteGraph {

    private PrerequisiteGraph() {
    }

    /** True when following "needs" edges from any item leads back to itself (a self reference is a cycle). */
    public static boolean hasCycle(Map<UUID, Set<UUID>> needs) {
        Map<UUID, Integer> state = new HashMap<>(); // 1 = on stack, 2 = done
        for (UUID start : needs.keySet()) {
            if (state.containsKey(start)) {
                continue;
            }
            Deque<UUID> stack = new ArrayDeque<>();
            Deque<java.util.Iterator<UUID>> iterators = new ArrayDeque<>();
            stack.push(start);
            iterators.push(needs.getOrDefault(start, Set.of()).iterator());
            state.put(start, 1);
            while (!stack.isEmpty()) {
                var it = iterators.peek();
                if (it.hasNext()) {
                    UUID next = it.next();
                    Integer s = state.get(next);
                    if (s != null && s == 1) {
                        return true;
                    }
                    if (s == null) {
                        state.put(next, 1);
                        stack.push(next);
                        iterators.push(needs.getOrDefault(next, Set.of()).iterator());
                    }
                } else {
                    state.put(stack.pop(), 2);
                    iterators.pop();
                }
            }
        }
        return false;
    }

    /** Convenience for tests: adds {@code item -> required} to a mutable map. */
    public static void add(Map<UUID, Set<UUID>> needs, UUID item, UUID required) {
        needs.computeIfAbsent(item, k -> new HashSet<>()).add(required);
    }
}
