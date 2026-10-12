package me.amanullah.course.schedule;

import me.amanullah.course.course.ItemType;
import java.time.Instant;
import java.util.UUID;

/**
 * {@code id} is a stable synthetic id: {@code <entityType>:<entityId>:<action>}. {@code OPENS}/{@code CLOSES} are the
 * start and end of a quiz/exam availability window (entity type {@code ITEM}); {@code DUE} is the due date of an
 * assignment item and {@code SESSION} the start of a live session (entity type {@code SESSION}, {@code title} is the
 * session title).
 */
public record ScheduleEventDto(String id, EntityType entityType, UUID entityId, UUID courseId, String courseTitle,
                               String title, ItemType itemType, Action action, Instant at) {

    public enum EntityType { COURSE, MODULE, ITEM, SESSION }

    public enum Action { PUBLISH, UNPUBLISH, OPENS, CLOSES, DUE, SESSION }
}
