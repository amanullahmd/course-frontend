package me.amanullah.course.user;

/** Password rule: at least 8 characters containing a letter and a digit. */
public final class PasswordPolicy {

    public static final String REGEX = "^(?=.*\\p{L})(?=.*\\d).{8,128}$";
    public static final String MESSAGE = "must be at least 8 characters and contain a letter and a digit";

    private PasswordPolicy() {
    }
}
