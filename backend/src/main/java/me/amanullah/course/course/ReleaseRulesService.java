package me.amanullah.course.course;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.course.CourseDtos.ContentItemDto;
import me.amanullah.course.course.CourseDtos.ModuleDto;
import me.amanullah.course.course.CourseDtos.PrerequisiteRef;
import me.amanullah.course.course.CourseDtos.ReleaseRulesRequest;
import me.amanullah.course.security.CurrentUser;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Instructor side: drip offsets, required/optional and prerequisites of items and modules. */
@Service
public class ReleaseRulesService {

    private final CourseAccess access;
    private final ContentItemRepository items;
    private final ReleasePrerequisiteRepository prerequisites;
    private final ContentService contentService;

    public ReleaseRulesService(CourseAccess access, ContentItemRepository items,
                               ReleasePrerequisiteRepository prerequisites, ContentService contentService) {
        this.access = access;
        this.items = items;
        this.prerequisites = prerequisites;
        this.contentService = contentService;
    }

    @Transactional
    public ContentItemDto updateItem(CurrentUser me, UUID itemId, ReleaseRulesRequest req) {
        ContentItem item = access.item(itemId, me);
        Course course = item.getModule().getCourse();
        Map<UUID, Integer> wanted = validated(course.getId(), ReleaseTarget.ITEM, item.getId(), req.prerequisites());
        replace(course.getId(), ReleaseTarget.ITEM, item.getId(), wanted);
        item.setRequired(req.required() == null || req.required());
        item.setReleaseOffsetDays(req.releaseOffsetDays());
        item.touch();
        course.touch();
        return contentService.itemDto(item);
    }

    @Transactional
    public ModuleDto updateModule(CurrentUser me, UUID moduleId, ReleaseRulesRequest req) {
        CourseModule module = access.module(moduleId, me);
        Course course = module.getCourse();
        Map<UUID, Integer> wanted = validated(course.getId(), ReleaseTarget.MODULE, module.getId(), req.prerequisites());
        replace(course.getId(), ReleaseTarget.MODULE, module.getId(), wanted);
        module.setReleaseOffsetDays(req.releaseOffsetDays());
        module.touch();
        course.touch();
        return contentService.moduleDto(module);
    }

    /** Removes the prerequisites attached to the given modules and items (call before deleting them). */
    @Transactional
    public void deleteFor(Set<UUID> moduleIds, Set<UUID> itemIds) {
        if (!moduleIds.isEmpty()) {
            prerequisites.deleteByTargets(ReleaseTarget.MODULE, moduleIds);
        }
        if (!itemIds.isEmpty()) {
            prerequisites.deleteByTargets(ReleaseTarget.ITEM, itemIds);
        }
    }

    private void replace(UUID courseId, ReleaseTarget type, UUID targetId, Map<UUID, Integer> wanted) {
        prerequisites.deleteAll(prerequisites.findByTargetTypeAndTargetId(type, targetId));
        prerequisites.flush();
        wanted.forEach((required, percent) -> prerequisites.save(new ReleasePrerequisite(type, targetId, required, percent)));
        prerequisites.flush();
    }

    /** Validates the requested prerequisites and returns {requiredItemId -> minPercent}. */
    private Map<UUID, Integer> validated(UUID courseId, ReleaseTarget type, UUID targetId,
                                         List<PrerequisiteRef> requested) {
        Map<UUID, Integer> wanted = new LinkedHashMap<>();
        if (requested != null) {
            requested.forEach(r -> wanted.put(r.itemId(), r.minPercent()));
        }
        List<ContentItem> outline = items.findOutline(courseId);
        Map<UUID, ContentItem> byId = new HashMap<>();
        outline.forEach(i -> byId.put(i.getId(), i));
        for (Map.Entry<UUID, Integer> e : wanted.entrySet()) {
            ContentItem required = byId.get(e.getKey());
            if (required == null) {
                throw ValidationException.field("prerequisites", "validation.release.prereqCourse");
            }
            if (type == ReleaseTarget.ITEM && required.getId().equals(targetId)) {
                throw ValidationException.field("prerequisites", "validation.release.prereqSelf");
            }
            if (e.getValue() != null && !required.getType().isAssessment()) {
                throw ValidationException.field("prerequisites", "validation.release.minPercentType");
            }
        }
        // Cycle check on the whole course: the new rules replace the old ones of the target.
        Map<UUID, Set<UUID>> needs = new HashMap<>();
        Map<UUID, List<UUID>> itemsOfModule = new HashMap<>();
        outline.forEach(i -> itemsOfModule.computeIfAbsent(i.getModule().getId(), k -> new java.util.ArrayList<>())
                .add(i.getId()));
        List<ReleasePrerequisite> existing = prerequisites.findByCourse(courseId);
        for (ReleasePrerequisite p : existing) {
            if (p.getTargetType() == type && p.getTargetId().equals(targetId)) {
                continue;
            }
            expand(needs, itemsOfModule, p.getTargetType(), p.getTargetId(), p.getRequiresItemId());
        }
        wanted.keySet().forEach(req -> expand(needs, itemsOfModule, type, targetId, req));
        if (PrerequisiteGraph.hasCycle(needs)) {
            throw new BadRequestException("PREREQUISITE_CYCLE", "These prerequisites would form a cycle");
        }
        return wanted;
    }

    private static void expand(Map<UUID, Set<UUID>> needs, Map<UUID, List<UUID>> itemsOfModule, ReleaseTarget type,
                               UUID targetId, UUID required) {
        if (type == ReleaseTarget.ITEM) {
            PrerequisiteGraph.add(needs, targetId, required);
        } else {
            itemsOfModule.getOrDefault(targetId, List.of()).forEach(i -> PrerequisiteGraph.add(needs, i, required));
        }
    }
}
