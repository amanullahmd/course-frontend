package me.amanullah.course.live;

import java.net.URI;
import java.util.Locale;

final class UrlChecks {

    private UrlChecks() {
    }

    static boolean isHttpUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
