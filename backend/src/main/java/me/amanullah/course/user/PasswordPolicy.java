package me.amanullah.course.user;

/**
 * Password rule: 8–64 characters containing a letter and a digit (BCrypt only uses the first 72 bytes).
 * {@link #MESSAGE} is a message key resolved from {@code messages*.properties} by Bean Validation.
 */
public final class PasswordPolicy {

    public static final String REGEX = "^(?=.*\\p{L})(?=.*\\d).{8,64}$";
    public static final String MESSAGE = "{validation.password}";
    public static final int MAX = 64;
    public static final String LOCALE_REGEX = "^(en|de)$";
    public static final String LOCALE_MESSAGE = "{validation.locale}";

    private PasswordPolicy() {
    }
}
