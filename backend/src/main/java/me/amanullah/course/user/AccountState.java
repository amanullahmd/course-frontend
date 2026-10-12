package me.amanullah.course.user;

/** Minimal projection of the account flags that decide whether an access token is still acceptable. */
public record AccountState(boolean enabled, Role role) {
}
