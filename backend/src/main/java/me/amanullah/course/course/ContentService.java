package me.amanullah.course.course;

import me.amanullah.course.assessment.AssessmentService;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.publication.PublicationRequest;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.common.util.TextLimits;
import me.amanullah.course.course.CourseDtos.ContentItemDto;
import me.amanullah.course.course.CourseDtos.ItemUpsert;
import me.amanullah.course.course.CourseDtos.ModuleDto;
import me.amanullah.course.course.CourseDtos.ModuleUpsert;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.security.CurrentUser;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Modules and content items of a course (instructor side). */
@Service
public class ContentService {

    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final CourseAccess access;
    private final CourseMapper mapper;
    private final CourseStats stats;
    private final MediaService mediaService;
    private final AssessmentService assessmentService;
    private final ReleasePrerequisiteRepository prerequisites;
    private final Clock clock;

    public ContentService(CourseModuleRepository modules, ContentItemRepository items, CourseAccess access,
                          CourseMapper mapper, CourseStats stats, MediaService mediaService,
                          AssessmentService assessmentService, ReleasePrerequisiteRepository prerequisites,
                          Clock clock) {
        this.modules = modules;
        this.items = items;
        this.access = access;
        this.mapper = mapper;
        this.stats = stats;
        this.mediaService = mediaService;
        this.assessmentService = assessmentService;
        this.prerequisites = prerequisites;
        this.clock = clock;
    }

    // ---------------- modules ----------------

    @Transactional
    public ModuleDto createModule(CurrentUser me, UUID courseId, ModuleUpsert req) {
        Course course = access.course(courseId, me);
        int position = (int) modules.countByCourseId(course.getId());
        CourseModule module = modules.save(new CourseModule(course, req.title().trim(),
                CourseService.blankToNull(req.description()), position));
        course.touch();
        return moduleDto(module);
    }

    @Transactional
    public ModuleDto updateModule(CurrentUser me, UUID id, ModuleUpsert req) {
        CourseModule module = access.module(id, me);
        module.setTitle(req.title().trim());
        module.setDescription(CourseService.blankToNull(req.description()));
        module.getCourse().touch();
        return moduleDto(module);
    }

    @Transactional
    public void deleteModule(CurrentUser me, UUID id) {
        CourseModule module = access.module(id, me);
        UUID courseId = module.getCourse().getId();
        module.getCourse().touch();
        Set<UUID> itemIds = new HashSet<>();
        items.findByModuleIdOrderByPositionAsc(module.getId()).forEach(i -> itemIds.add(i.getId()));
        prerequisites.deleteByTargets(ReleaseTarget.MODULE, Set.of(module.getId()));
        if (!itemIds.isEmpty()) {
            prerequisites.deleteByTargets(ReleaseTarget.ITEM, itemIds);
        }
        modules.deleteModuleById(module.getId());
        List<CourseModule> rest = modules.findByCourseIdOrderByPositionAsc(courseId);
        for (int i = 0; i < rest.size(); i++) {
            rest.get(i).setPosition(i);
        }
    }

    @Transactional
    public ModuleDto publishModule(CurrentUser me, UUID id, PublicationRequest req) {
        CourseModule module = access.module(id, me);
        req.applyTo(module);
        module.touch();
        module.getCourse().touch();
        return moduleDto(module);
    }

    // ---------------- items ----------------

    @Transactional
    public ContentItemDto createItem(CurrentUser me, UUID moduleId, ItemUpsert req) {
        CourseModule module = access.module(moduleId, me);
        int position = (int) items.countByModuleId(module.getId());
        ContentItem item = new ContentItem(module, req.type(), position);
        apply(item, req, me);
        items.save(item);
        if (item.getType().isAssessment()) {
            assessmentService.ensureFor(item);
        }
        module.getCourse().touch();
        return itemDto(item);
    }

    @Transactional(readOnly = true)
    public ContentItemDto getItem(CurrentUser me, UUID id) {
        return itemDto(access.item(id, me));
    }

    @Transactional
    public ContentItemDto updateItem(CurrentUser me, UUID id, ItemUpsert req) {
        ContentItem item = access.item(id, me);
        apply(item, req, me);
        item.touch();
        if (item.getType().isAssessment()) {
            assessmentService.ensureFor(item);
        }
        item.getModule().getCourse().touch();
        return itemDto(item);
    }

    @Transactional
    public void deleteItem(CurrentUser me, UUID id) {
        ContentItem item = access.item(id, me);
        UUID moduleId = item.getModule().getId();
        item.getModule().getCourse().touch();
        prerequisites.deleteByTargets(ReleaseTarget.ITEM, Set.of(item.getId()));
        items.deleteItemById(item.getId());
        compact(moduleId);
    }

    @Transactional
    public ContentItemDto publishItem(CurrentUser me, UUID id, PublicationRequest req) {
        ContentItem item = access.item(id, me);
        req.applyTo(item);
        item.touch();
        item.getModule().getCourse().touch();
        return itemDto(item);
    }

    /**
     * Sets the order of a module's items. Ids of items from other modules of the same course are moved into this
     * module; all items currently in the module must be listed.
     */
    @Transactional
    public void reorderItems(CurrentUser me, UUID moduleId, List<UUID> ids) {
        CourseModule target = access.module(moduleId, me);
        UUID courseId = target.getCourse().getId();
        if (new HashSet<>(ids).size() != ids.size()) {
            throw ValidationException.field("ids", "validation.ids.duplicates");
        }
        List<ContentItem> current = items.findByModuleIdOrderByPositionAsc(target.getId());
        Set<UUID> requested = new HashSet<>(ids);
        if (!current.stream().allMatch(i -> requested.contains(i.getId()))) {
            throw ValidationException.field("ids", "validation.ids.allItems");
        }
        Map<UUID, ContentItem> byId = new HashMap<>();
        current.forEach(i -> byId.put(i.getId(), i));
        Set<UUID> sourceModules = new LinkedHashSet<>();
        List<ContentItem> ordered = new ArrayList<>();
        for (UUID id : ids) {
            ContentItem item = byId.get(id);
            if (item == null) {
                item = items.findWithCourse(id).orElse(null);
                if (item == null || !item.getModule().getCourse().getId().equals(courseId)) {
                    throw ValidationException.field("ids", "validation.ids.unknownItem", id);
                }
                sourceModules.add(item.getModule().getId());
                item.setModule(target);
            }
            ordered.add(item);
        }
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setPosition(i);
        }
        items.flush();
        sourceModules.forEach(this::compact);
        target.getCourse().touch();
    }

    private void compact(UUID moduleId) {
        List<ContentItem> rest = items.findByModuleIdOrderByPositionAsc(moduleId);
        for (int i = 0; i < rest.size(); i++) {
            rest.get(i).setPosition(i);
        }
    }

    private void apply(ContentItem item, ItemUpsert req, CurrentUser me) {
        item.setType(req.type());
        item.setTitle(req.title().trim());
        item.setSummary(CourseService.blankToNull(req.summary()));
        item.setBody(TextLimits.requireMax("body", HtmlSanitizer.sanitize(req.body()), 1_000_000));
        item.setDurationMinutes(req.durationMinutes());
        String url = CourseService.blankToNull(req.externalUrl());
        if (url != null && !isHttpUrl(url)) {
            throw ValidationException.field("externalUrl", "validation.httpUrl");
        }
        if (req.type() == ItemType.EMBED && url == null) {
            throw ValidationException.field("externalUrl", "validation.embedUrlRequired");
        }
        item.setExternalUrl(url);
        List<UUID> ids = req.attachmentIds() == null ? List.of() : List.copyOf(new LinkedHashSet<>(req.attachmentIds()));
        Map<UUID, MediaAsset> existing = new HashMap<>();
        item.getAttachments().forEach(m -> existing.put(m.getId(), m));
        List<MediaAsset> media = new ArrayList<>();
        for (UUID id : ids) {
            MediaAsset m = existing.get(id);
            media.add(m != null ? m : mediaService.requireUsable(id, me.id(), me.isAdmin()));
        }
        item.setAttachments(media);
    }

    static boolean isHttpUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public ModuleDto moduleDto(CourseModule module) {
        List<ContentItem> list = items.findByModuleIdOrderByPositionAsc(module.getId());
        var summaries = stats.assessmentSummaries(list.stream().map(ContentItem::getId).toList());
        Instant now = Instant.now(clock);
        UUID courseId = module.getCourse().getId();
        var prereqs = mapper.prerequisiteIndex(courseId);
        return new CourseDtos.ModuleDto(module.getId(), courseId, module.getTitle(), module.getDescription(),
                module.getPosition(), module.getPublishStatus(), module.getPublishAt(), module.getUnpublishAt(),
                me.amanullah.course.common.publication.Visibility.of(module, now), module.getReleaseOffsetDays(),
                prereqs.getOrDefault(module.getId(), List.of()),
                list.stream().map(i -> mapper.toItemDto(i, module.getId(), courseId, summaries.get(i.getId()), prereqs, now))
                        .toList());
    }

    public ContentItemDto itemDto(ContentItem item) {
        var summaries = stats.assessmentSummaries(List.of(item.getId()));
        UUID courseId = item.getModule().getCourse().getId();
        return mapper.toItemDto(item, item.getModule().getId(), courseId, summaries.get(item.getId()),
                mapper.prerequisiteIndex(courseId), Instant.now(clock));
    }
}
