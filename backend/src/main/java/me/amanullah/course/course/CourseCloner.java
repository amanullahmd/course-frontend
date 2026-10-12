package me.amanullah.course.course;

import me.amanullah.course.assessment.Assessment;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assessment.Question;
import me.amanullah.course.assessment.QuestionOption;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.util.SlugGenerator;
import me.amanullah.course.course.CourseDtos.CloneRequest;
import me.amanullah.course.course.CourseDtos.ContentItemDto;
import me.amanullah.course.course.CourseDtos.CourseDto;
import me.amanullah.course.course.CourseDtos.ModuleDto;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deep copies: a whole course (as a draft owned by the caller), a module or a single item. Media files are shared by
 * reference, enrollments, progress, attempts and certificates are never copied. Release rules are copied with ids
 * remapped through an old to new map.
 */
@Service
public class CourseCloner {

    static final int TITLE_MAX = 200;

    private final CourseAccess access;
    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final AssessmentRepository assessments;
    private final ReleasePrerequisiteRepository prerequisites;
    private final UserRepository users;
    private final EntityCopier copier;
    private final EntityManager em;
    private final Messages messages;
    private final CourseService courseService;
    private final ContentService contentService;
    private final ObjectProvider<ItemCopyContributor> contributors;

    public CourseCloner(CourseAccess access, CourseRepository courses, CourseModuleRepository modules,
                        ContentItemRepository items, AssessmentRepository assessments,
                        ReleasePrerequisiteRepository prerequisites, UserRepository users, EntityCopier copier,
                        EntityManager em, Messages messages, CourseService courseService,
                        ContentService contentService, ObjectProvider<ItemCopyContributor> contributors) {
        this.access = access;
        this.courses = courses;
        this.modules = modules;
        this.items = items;
        this.assessments = assessments;
        this.prerequisites = prerequisites;
        this.users = users;
        this.copier = copier;
        this.em = em;
        this.messages = messages;
        this.courseService = courseService;
        this.contentService = contentService;
        this.contributors = contributors;
    }

    // ---------------- course ----------------

    @Transactional
    public CourseDto cloneCourse(CurrentUser me, UUID courseId, CloneRequest req) {
        Course source = access.course(courseId, me);
        String title = req.title().trim();
        if (title.isEmpty()) {
            throw ValidationException.field("title", "validation.required");
        }
        UnaryOperator<Instant> dates = dates(req.keepSchedule(), req.shiftDays());
        Course copy = new Course(users.getReferenceById(me.id()), SlugGenerator.unique(title, courses::existsBySlug));
        copy.setTitle(title);
        copy.setSubtitle(source.getSubtitle());
        copy.setDescription(source.getDescription());
        copy.setLevel(source.getLevel());
        copy.setTags(source.getTags());
        copy.setCoverImage(source.getCoverImage());
        copy.setEnrollmentMode(source.getEnrollmentMode());
        copy.setCapacity(source.getCapacity());
        copy.setProgression(source.getProgression());
        copy.setClonedFromId(source.getId());
        copy.setPublishAt(dates.apply(source.getPublishAt()));
        copy.setUnpublishAt(dates.apply(source.getUnpublishAt()));
        courses.save(copy);

        Map<UUID, UUID> idMap = new HashMap<>();
        for (CourseModule m : modules.findByCourseIdOrderByPositionAsc(source.getId())) {
            copyModule(m, copy, m.getPosition(), dates, idMap, "");
        }
        copyPrerequisites(source.getId(), idMap);
        em.flush();
        em.clear();
        return courseService.get(me, copy.getId());
    }

    // ---------------- module ----------------

    @Transactional
    public ModuleDto duplicateModule(CurrentUser me, UUID moduleId) {
        CourseModule source = access.module(moduleId, me);
        Course course = source.getCourse();
        List<CourseModule> all = modules.findByCourseIdOrderByPositionAsc(course.getId());
        int at = source.getPosition() + 1;
        for (CourseModule m : all) {
            if (m.getPosition() >= at) {
                m.setPosition(m.getPosition() + 1);
            }
        }
        modules.flush();
        Map<UUID, UUID> idMap = new HashMap<>();
        CourseModule copy = copyModule(source, course, at, dates(true, 0), idMap, copySuffix());
        // module-level rules and item rules inside the module; references outside keep pointing at the originals
        for (ReleasePrerequisite p : prerequisites.findByCourse(course.getId())) {
            boolean inside = idMap.containsKey(p.getTargetId());
            if (inside) {
                prerequisites.save(new ReleasePrerequisite(p.getTargetType(), idMap.get(p.getTargetId()),
                        idMap.getOrDefault(p.getRequiresItemId(), p.getRequiresItemId()), p.getMinPercent()));
            }
        }
        course.touch();
        em.flush();
        UUID id = copy.getId();
        em.clear();
        return contentService.moduleDto(modules.findWithCourse(id).orElseThrow());
    }

    // ---------------- item ----------------

    @Transactional
    public ContentItemDto duplicateItem(CurrentUser me, UUID itemId, UUID targetModuleId) {
        ContentItem source = access.item(itemId, me);
        Course course = source.getModule().getCourse();
        CourseModule target = source.getModule();
        boolean sameModule = targetModuleId == null || targetModuleId.equals(source.getModule().getId());
        int position;
        if (sameModule) {
            position = source.getPosition() + 1;
            for (ContentItem i : items.findByModuleIdOrderByPositionAsc(target.getId())) {
                if (i.getPosition() >= position) {
                    i.setPosition(i.getPosition() + 1);
                }
            }
            items.flush();
        } else {
            target = access.module(targetModuleId, me);
            if (!target.getCourse().getId().equals(course.getId())) {
                throw ValidationException.field("targetModuleId", "validation.release.otherCourse");
            }
            position = (int) items.countByModuleId(target.getId());
        }
        Map<UUID, UUID> idMap = new HashMap<>();
        ContentItem copy = copyItem(source, target, position, dates(true, 0), idMap, copySuffix());
        for (ReleasePrerequisite p : prerequisites.findByTargetTypeAndTargetId(ReleaseTarget.ITEM, source.getId())) {
            prerequisites.save(new ReleasePrerequisite(ReleaseTarget.ITEM, copy.getId(), p.getRequiresItemId(),
                    p.getMinPercent()));
        }
        course.touch();
        em.flush();
        UUID id = copy.getId();
        em.clear();
        return contentService.itemDto(items.findWithCourse(id).orElseThrow());
    }

    // ---------------- copying ----------------

    private CourseModule copyModule(CourseModule source, Course course, int position, UnaryOperator<Instant> dates,
                                    Map<UUID, UUID> idMap, String suffix) {
        CourseModule copy = new CourseModule(course, withSuffix(source.getTitle(), suffix), source.getDescription(),
                position);
        copy.setPublishStatus(PublishStatus.DRAFT);
        copy.setPublishAt(dates.apply(source.getPublishAt()));
        copy.setUnpublishAt(dates.apply(source.getUnpublishAt()));
        copy.setReleaseOffsetDays(source.getReleaseOffsetDays());
        modules.save(copy);
        idMap.put(source.getId(), copy.getId());
        for (ContentItem i : items.findByModuleIdOrderByPositionAsc(source.getId())) {
            copyItem(i, copy, i.getPosition(), dates, idMap, "");
        }
        return copy;
    }

    private ContentItem copyItem(ContentItem source, CourseModule module, int position, UnaryOperator<Instant> dates,
                                 Map<UUID, UUID> idMap, String suffix) {
        ContentItem copy = new ContentItem(module, source.getType(), position);
        copy.setTitle(withSuffix(source.getTitle(), suffix));
        copy.setSummary(source.getSummary());
        copy.setBody(source.getBody());
        copy.setExternalUrl(source.getExternalUrl());
        copy.setDurationMinutes(source.getDurationMinutes());
        copy.setPublishStatus(PublishStatus.DRAFT);
        copy.setPublishAt(dates.apply(source.getPublishAt()));
        copy.setUnpublishAt(dates.apply(source.getUnpublishAt()));
        copy.setReleaseOffsetDays(source.getReleaseOffsetDays());
        copy.setRequired(source.isRequired());
        copy.setAttachments(new ArrayList<>(source.getAttachments()));
        items.save(copy);
        idMap.put(source.getId(), copy.getId());
        if (source.getType().isAssessment()) {
            assessments.findByItemId(source.getId()).ifPresent(a -> copyAssessment(a, copy, dates));
        }
        contributors.orderedStream().forEach(c -> c.copy(source, copy, dates));
        return copy;
    }

    private void copyAssessment(Assessment source, ContentItem item, UnaryOperator<Instant> dates) {
        Assessment copy = new Assessment(item);
        copier.copyColumns(Assessment.class, source, copy, Set.of("item", "questions"));
        copy.setAvailableFrom(dates.apply(source.getAvailableFrom()));
        copy.setAvailableUntil(dates.apply(source.getAvailableUntil()));
        for (Question q : source.getQuestions()) {
            Question qc = new Question(copy);
            copier.copyColumns(Question.class, q, qc, Set.of("assessment", "options"));
            for (QuestionOption o : q.getOptions()) {
                QuestionOption oc = new QuestionOption(qc);
                copier.copyColumns(QuestionOption.class, o, oc, Set.of("question"));
                qc.getOptions().add(oc);
            }
            copy.getQuestions().add(qc);
        }
        assessments.save(copy);
    }

    /** Course clone: all rules of the source course, ids remapped; references to unknown items are dropped. */
    private void copyPrerequisites(UUID sourceCourseId, Map<UUID, UUID> idMap) {
        for (ReleasePrerequisite p : prerequisites.findByCourse(sourceCourseId)) {
            UUID target = idMap.get(p.getTargetId());
            UUID requires = idMap.get(p.getRequiresItemId());
            if (target != null && requires != null) {
                prerequisites.save(new ReleasePrerequisite(p.getTargetType(), target, requires, p.getMinPercent()));
            }
        }
    }

    // ---------------- helpers ----------------

    /** Keeps or drops dates; kept dates are moved by {@code shiftDays} (may be negative or null). */
    static UnaryOperator<Instant> dates(boolean keep, Integer shiftDays) {
        if (!keep) {
            return d -> null;
        }
        Duration shift = Duration.ofDays(shiftDays == null ? 0 : shiftDays);
        return d -> d == null ? null : d.plus(shift);
    }

    private String copySuffix() {
        return " " + messages.get("copySuffix");
    }

    static String withSuffix(String title, String suffix) {
        if (suffix.isEmpty()) {
            return title;
        }
        int room = TITLE_MAX - suffix.length();
        return (title.length() > room ? title.substring(0, Math.max(0, room)) : title) + suffix;
    }
}
