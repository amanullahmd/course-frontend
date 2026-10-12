package me.amanullah.course.common.util;

import me.amanullah.course.common.exception.ValidationException;

/** Guards database column sizes for values that may grow during processing (e.g. HTML sanitizing/escaping). */
public final class TextLimits {

    private TextLimits() {
    }

    public static String requireMax(String field, String value, int max) {
        if (value != null && value.length() > max) {
            throw ValidationException.field(field, "validation.tooLong", max);
        }
        return value;
    }
}
