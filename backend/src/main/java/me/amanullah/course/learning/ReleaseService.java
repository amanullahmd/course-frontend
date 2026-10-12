package me.amanullah.course.learning;

import jakarta.persistence.EntityManager;
import me.amanullah.course.assessment.AttemptStatus;
import me.amanullah.course.assessment.Grader;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.ReleasePrerequisite;
import me.amanullah.course.course.ReleasePrerequisiteRepository;
import me.amanullah.course.course.ReleaseTarget;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.learning.LearningDtos.LockDto;
import me.amanullah.course.learning.LearningDtos.LockPrerequisite;
import me.amanullah.course.learning.ReleasePolicy.State;
import me.amanullah.course.security.CurrentUser;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads the data {@link ReleasePolicy} needs for one learner and course. */
@Service
public class ReleaseService {

    private final ProgressService progress;
    private final ReleasePrerequisiteRepository prerequisites;
    private final EnrollmentRepository enrollments;
    private final EntityManager em;

    public ReleaseService(ProgressService progress, ReleasePrerequisiteRepository prerequisites,
                          EnrollmentRepository enrollments, EntityManager em) {
        this.progress = progress;
        this.prerequisites = prerequisites;
        this.enrollments = enrollments;
        this.em = em;
    }

    /** State of every live item of the course for this user; managers (preview) get everything AVAILABLE. */
    @Transactional(readOnly = true)
    public Map<UUID, State> states(Course course, CurrentUser me, Instant now) {
        List<ContentItem> live = progress.liveItems(List.of(course.getId()), now).getOrDefault(course.getId(), List.of());
        return states(course, me, live, now);
    }

    @Transactional(readOnly = true)
    public Map<UUID, State> states(Course course, CurrentUser me, List<ContentItem> live, Instant now) {
        boolean preview = CourseAccess.canManage(course, me);
        Instant anchor = null;
        if (!preview) {
            anchor = enrollments.findByCourseIdAndStudentId(course.getId(), me.id())
                    .map(e -> e.getDecidedAt() != null ? e.getDecidedAt() : e.getAppliedAt()).orElse(now);
        }
        List<UUID> ids = live.stream().map(ContentItem::getId).toList();
        Set<UUID> completed = preview ? Set.of() : progress.completedItemIds(me.id(), ids);
        Map<UUID, Integer> passing = new HashMap<>();
        Map<UUID, Double> best = new HashMap<>();
        if (!preview) {
            List<UUID> assessmentItems = live.stream().filter(i -> i.getType().isAssessment()).map(ContentItem::getId)
                    .toList();
            if (!assessmentItems.isEmpty()) {
                for (Object[] row : em.createQuery("""
                        select s.item.id, s.passingScore from Assessment s
                        where s.item.id in :ids and s.questions is not empty
                        """, Object[].class).setParameter("ids", assessmentItems).getResultList()) {
                    passing.put((UUID) row[0], (Integer) row[1]);
                }
                for (Object[] row : em.createQuery("""
                        select a.assessment.item.id, a.score, a.maxScore from Attempt a
                        where a.student.id = :studentId and a.assessment.item.id in :ids and a.status = :graded
                        """, Object[].class).setParameter("studentId", me.id()).setParameter("ids", assessmentItems)
                        .setParameter("graded", AttemptStatus.GRADED).getResultList()) {
                    Double pct = Grader.percent((Double) row[1], (Double) row[2]);
                    if (pct != null) {
                        best.merge((UUID) row[0], pct, Math::max);
                    }
                }
            }
        }
        Map<UUID, List<ReleasePolicy.Prereq>> rules = new HashMap<>();
        for (ReleasePrerequisite p : prerequisites.findByCourse(course.getId())) {
            rules.computeIfAbsent(p.getTargetId(), k -> new ArrayList<>())
                    .add(new ReleasePolicy.Prereq(p.getRequiresItemId(), p.getMinPercent()));
        }
        Map<UUID, List<ReleasePolicy.Item>> byModule = new LinkedHashMap<>();
        Map<UUID, CourseModule> modules = new HashMap<>();
        for (ContentItem i : live) {
            modules.put(i.getModule().getId(), i.getModule());
            byModule.computeIfAbsent(i.getModule().getId(), k -> new ArrayList<>()).add(new ReleasePolicy.Item(i.getId(),
                    i.getTitle(), i.isRequired(), i.getReleaseOffsetDays(), passing.get(i.getId())));
        }
        List<ReleasePolicy.Module> outline = byModule.entrySet().stream()
                .map(e -> new ReleasePolicy.Module(e.getKey(), modules.get(e.getKey()).getReleaseOffsetDays(), e.getValue()))
                .toList();
        return ReleasePolicy.evaluate(new ReleasePolicy.Outline(course.getProgression(), outline, rules),
                new ReleasePolicy.Context(anchor, completed, best), now);
    }

    public static LockDto toDto(State state) {
        if (state == null || !state.locked()) {
            return null;
        }
        return new LockDto(state.reason().name(), state.unlockAt(), state.blockers().stream()
                .map(b -> new LockPrerequisite(b.itemId(), b.title(), b.minPercent())).toList());
    }

    /** Throws {@link ItemLockedException} when the item is locked for this learner. */
    @Transactional(readOnly = true)
    public void requireUnlocked(Course course, UUID itemId, CurrentUser me, Instant now) {
        if (CourseAccess.canManage(course, me)) {
            return;
        }
        LockDto lock = toDto(states(course, me, now).get(itemId));
        if (lock != null) {
            throw new ItemLockedException(lock);
        }
    }
}
