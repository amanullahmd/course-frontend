package me.amanullah.course.learning;

import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.learning.LearningDtos.LockDto;

/** 403 {@code ITEM_LOCKED}: the item is live but not yet released for this learner. */
public class ItemLockedException extends ForbiddenException {

    public ItemLockedException(LockDto lock) {
        super("ITEM_LOCKED", "This item is not available yet");
        property("lockReason", lock.reason());
        property("unlockAt", lock.unlockAt());
        property("prerequisites", lock.prerequisites());
    }
}
