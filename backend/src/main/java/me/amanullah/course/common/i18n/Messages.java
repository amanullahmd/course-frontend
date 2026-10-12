package me.amanullah.course.common.i18n;

import java.util.Locale;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/** Convenience access to {@code messages*.properties}. */
@Component
public class Messages {

    private final MessageSource messageSource;

    public Messages(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    /** Resolves in the locale of the current request. */
    public String get(String key, Object... args) {
        return get(LocaleContextHolder.getLocale(), key, args);
    }

    public String get(Locale locale, String key, Object... args) {
        return messageSource.getMessage(key, args, key, locale);
    }

    /** Returns {@code null} when the key is unknown. */
    public String find(Locale locale, String key, Object... args) {
        return messageSource.getMessage(key, args, null, locale);
    }
}
