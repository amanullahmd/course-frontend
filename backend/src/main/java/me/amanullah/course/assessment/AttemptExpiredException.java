package me.amanullah.course.assessment;

import me.amanullah.course.common.exception.ConflictException;

/** 409 {@code ATTEMPT_EXPIRED}: the attempt's time is up (deadline or window end plus grace has passed). */
public class AttemptExpiredException extends ConflictException {

    public AttemptExpiredException() {
        super("ATTEMPT_EXPIRED", "Time is up for this attempt; your saved answers were submitted automatically");
    }
}
