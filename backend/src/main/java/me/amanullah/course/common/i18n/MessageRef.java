package me.amanullah.course.common.i18n;

/** A message key with arguments, resolved later in the request (or recipient) locale. */
public record MessageRef(String key, Object... args) {
}
