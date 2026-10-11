package me.amanullah.course.common.i18n;

import java.util.List;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/** English (default) and German, chosen from the {@code Accept-Language} header. */
@Configuration
public class I18nConfig {

    public static final Locale GERMAN = Locale.GERMAN;
    public static final List<Locale> SUPPORTED = List.of(Locale.ENGLISH, Locale.GERMAN);

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(SUPPORTED);
        resolver.setDefaultLocale(Locale.ENGLISH);
        return resolver;
    }

    /** Maps a stored language tag ("en"/"de") to a supported locale, defaulting to English. */
    public static Locale toLocale(String tag) {
        return "de".equalsIgnoreCase(tag) ? Locale.GERMAN : Locale.ENGLISH;
    }

    /** Normalizes a locale to a supported language tag ("en"/"de"). */
    public static String toTag(Locale locale) {
        return locale != null && "de".equals(locale.getLanguage()) ? "de" : "en";
    }
}
