package me.amanullah.course.course;

import java.time.Instant;
import java.util.function.UnaryOperator;

/**
 * Extension point for item types that own data in other tables (flashcard decks, assignments, ...): called by
 * {@link CourseCloner} after the {@link ContentItem} copy has been saved, once per copied item. Implementations copy
 * their own rows from {@code source} to {@code target}; {@code dates} maps schedule instants (shift or drop them).
 */
public interface ItemCopyContributor {

    void copy(ContentItem source, ContentItem target, UnaryOperator<Instant> dates);
}
