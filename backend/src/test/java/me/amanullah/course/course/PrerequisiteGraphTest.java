package me.amanullah.course.course;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PrerequisiteGraphTest {

    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UUID c = UUID.randomUUID();
    private final Map<UUID, Set<UUID>> needs = new HashMap<>();

    @Test
    void emptyAndChainsAreAcyclic() {
        assertThat(PrerequisiteGraph.hasCycle(needs)).isFalse();
        PrerequisiteGraph.add(needs, a, b);
        PrerequisiteGraph.add(needs, b, c);
        PrerequisiteGraph.add(needs, a, c);
        assertThat(PrerequisiteGraph.hasCycle(needs)).isFalse();
    }

    @Test
    void detectsSelfLoopsAndLongerCycles() {
        PrerequisiteGraph.add(needs, a, a);
        assertThat(PrerequisiteGraph.hasCycle(needs)).isTrue();
        needs.clear();
        PrerequisiteGraph.add(needs, a, b);
        PrerequisiteGraph.add(needs, b, c);
        PrerequisiteGraph.add(needs, c, a);
        assertThat(PrerequisiteGraph.hasCycle(needs)).isTrue();
    }
}
