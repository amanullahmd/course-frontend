package de.sprachweg.course;

import de.sprachweg.assessment.AssessmentService;
import de.sprachweg.common.exception.ValidationException;
import de.sprachweg.common.publication.PublicationRequest;
import de.sprachweg.common.util.HtmlSanitizer;
import de.sprachweg.course.CourseDtos.ContentItemDto;
import de.sprachweg.course.CourseDtos.ItemUpsert;
import de.sprachweg.course.CourseDtos.ModuleDto;
import de.sprachweg.course.CourseDtos.ModuleUpsert;
import de.sprachweg.media.MediaAsset;
import de.sprachweg.media.MediaService;
import de.sprachweg.security.CurrentUser;
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
    private final Clock clock;

    public ContentService(CourseModuleRepository modules, ContentItemRepository items, CourseAccess access,
                          CourseMapper mapper, CourseStats stats, MediaService mediaService,
                          AssessmentService assessmentService, Clock clock) {
        this.modules = modules;
        this.items = items;
        this.access = access;
        this.mapper = mapper;
        this.stats = stats;
        this.mediaService = mediaService;
        this.assessmentService = assessmentService;
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
            throw new ValidationException("ids must not contain duplicates", Map.of("ids", "must not contain duplicates"));
        }
        List<ContentItem> current = items.findByModuleIdOrderByPositionAsc(target.getId());
        Set<UUID> requested = new HashSet<>(ids);
        if (!current.stream().allMatch(i -> requested.contains(i.getId()))) {
            throw new ValidationException("ids must include all items of the module",
                    Map.of("ids", "must include all items of the module"));
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
                    throw new ValidationException("Unknown item id " + id, Map.of("ids", "unknown item " + id));
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
        item.setBody(HtmlSanitizer.sanitize(req.body()));
        item.setDurationMinutes(req.durationMinutes());
        String url = CourseService.blankToNull(req.externalUrl());
        if (url != null && !isHttpUrl(url)) {
            throw new ValidationException("externalUrl must be an http(s) URL",
                    Map.of("externalUrl", "must be an http(s) URL"));
        }
        if (req.type() == ItemType.EMBED && url == null) {
            throw new ValidationException("An embed needs an external URL", Map.of("externalUrl", "is required for EMBED"));
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

    private ModuleDto moduleDto(CourseModule module) {
        List<ContentItem> list = items.findByModuleIdOrderByPositionAsc(module.getId());
        var summaries = stats.assessmentSummaries(list.stream().map(ContentItem::getId).toList());
        Instant now = Instant.now(clock);
        UUID courseId = module.getCourse().getId();
        return new CourseDtos.ModuleDto(module.getId(), courseId, module.getTitle(), module.getDescription(),
                module.getPosition(), module.getPublishStatus(), module.getPublishAt(), module.getUnpublishAt(),
                de.sprachweg.common.publication.Visibility.of(module, now),
                list.stream().map(i -> mapper.toItemDto(i, module.getId(), courseId, summaries.get(i.getId()), now)).toList());
    }

    public ContentItemDto itemDto(ContentItem item) {
        var summaries = stats.assessmentSummaries(List.of(item.getId()));
        return mapper.toItemDto(item, item.getModule().getId(), item.getModule().getCourse().getId(),
                summaries.get(item.getId()), Instant.now(clock));
    }
}
