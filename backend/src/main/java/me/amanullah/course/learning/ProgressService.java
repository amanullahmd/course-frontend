package me.amanullah.course.learning;

import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Progress = completed live items / live items (0–100, rounded). */
@Service
public class ProgressService {

    private final ContentItemRepository items;
    private final ItemProgressRepository progress;
    private final Clock clock;

    public ProgressService(ContentItemRepository items, ItemProgressRepository progress, Clock clock) {
        this.items = items;
        this.progress = progress;
        this.clock = clock;
    }

    /** Live items of the given courses in outline order, grouped per course. */
    @Transactional(readOnly = true)
    public Map<UUID, List<ContentItem>> liveItems(Collection<UUID> courseIds, Instant now) {
        Map<UUID, List<ContentItem>> result = new HashMap<>();
        if (courseIds.isEmpty()) {
            return result;
        }
        for (ContentItem i : items.findOutlines(courseIds)) {
            Course c = i.getModule().getCourse();
            if (Visibility.isLive(c, now) && Visibility.isLive(i.getModule(), now) && Visibility.isLive(i, now)) {
                result.computeIfAbsent(c.getId(), k -> new ArrayList<>()).add(i);
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Set<UUID> completedItemIds(UUID studentId, Collection<UUID> itemIds) {
        Set<UUID> done = new HashSet<>();
        if (itemIds.isEmpty()) {
            return done;
        }
        for (Object[] row : progress.findCompleted(List.of(studentId), itemIds)) {
            done.add((UUID) row[1]);
        }
        return done;
    }

    /** Progress per student for one course. */
    @Transactional(readOnly = true)
    public Map<UUID, Integer> percentForStudents(UUID courseId, Collection<UUID> studentIds) {
        Map<UUID, Integer> result = new HashMap<>();
        if (studentIds.isEmpty()) {
            return result;
        }
        List<ContentItem> live = liveItems(List.of(courseId), Instant.now(clock)).getOrDefault(courseId, List.of());
        Map<UUID, Integer> done = new HashMap<>();
        if (!live.isEmpty()) {
            for (Object[] row : progress.findCompleted(studentIds, live.stream().map(ContentItem::getId).toList())) {
                done.merge((UUID) row[0], 1, Integer::sum);
            }
        }
        studentIds.forEach(s -> result.put(s, percent(done.getOrDefault(s, 0), live.size())));
        return result;
    }

    /** Progress of one student per course. */
    @Transactional(readOnly = true)
    public Map<UUID, Integer> percentForCourses(UUID studentId, Collection<UUID> courseIds) {
        Map<UUID, Integer> result = new HashMap<>();
        Map<UUID, List<ContentItem>> live = liveItems(courseIds, Instant.now(clock));
        Set<UUID> all = new HashSet<>();
        live.values().forEach(l -> l.forEach(i -> all.add(i.getId())));
        Set<UUID> done = completedItemIds(studentId, all);
        for (UUID courseId : courseIds) {
            List<ContentItem> l = live.getOrDefault(courseId, List.of());
            int completed = (int) l.stream().filter(i -> done.contains(i.getId())).count();
            result.put(courseId, percent(completed, l.size()));
        }
        return result;
    }

    public static int percent(int completed, int total) {
        return total == 0 ? 0 : (int) Math.round(completed * 100.0 / total);
    }
}
