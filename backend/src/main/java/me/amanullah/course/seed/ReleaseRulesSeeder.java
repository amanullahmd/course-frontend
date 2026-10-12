package me.amanullah.course.seed;

import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.CourseModuleRepository;
import me.amanullah.course.course.CourseProgression;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.ReleasePrerequisite;
import me.amanullah.course.course.ReleasePrerequisiteRepository;
import me.amanullah.course.course.ReleaseTarget;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Turns the demo course "Deutsch B1" into a small showcase of release rules once the base demo data exists: module by
 * module progression, the second module opens three days after enrollment, the interview lesson is optional and
 * needs the e-mail lesson. Approve a learner in that course to see locks in the outline.
 */
@Component
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class ReleaseRulesSeeder {

    private static final Logger log = LoggerFactory.getLogger(ReleaseRulesSeeder.class);

    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final ReleasePrerequisiteRepository prerequisites;
    private final TransactionTemplate tx;

    public ReleaseRulesSeeder(CourseRepository courses, CourseModuleRepository modules, ContentItemRepository items,
                              ReleasePrerequisiteRepository prerequisites, TransactionTemplate tx) {
        this.courses = courses;
        this.modules = modules;
        this.items = items;
        this.prerequisites = prerequisites;
        this.tx = tx;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void run() {
        tx.executeWithoutResult(status -> seed());
    }

    private void seed() {
        Course b1 = courses.findAll().stream()
                .filter(c -> "Deutsch B1: Alltag & Beruf".equals(c.getTitle())).findFirst().orElse(null);
        if (b1 == null || b1.getProgression() != CourseProgression.FREE) {
            return;
        }
        List<CourseModule> list = modules.findByCourseIdOrderByPositionAsc(b1.getId());
        if (list.size() < 2) {
            return;
        }
        List<ContentItem> second = items.findByModuleIdOrderByPositionAsc(list.get(1).getId());
        if (second.size() < 2 || prerequisites.count() > 0) {
            return;
        }
        b1.setProgression(CourseProgression.SEQUENTIAL_MODULES);
        list.get(1).setReleaseOffsetDays(3);
        ContentItem email = second.get(0);
        ContentItem interview = second.get(1);
        interview.setRequired(false);
        prerequisites.save(new ReleasePrerequisite(ReleaseTarget.ITEM, interview.getId(), email.getId(), null));
        log.info("Seeded release rules for \"{}\"", b1.getTitle());
    }
}
