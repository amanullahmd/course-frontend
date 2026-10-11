package de.sprachweg.media;

import de.sprachweg.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Creates and verifies HMAC-SHA256 signed media URLs so {@code <video>}, {@code <audio>}, {@code <img>} and
 * {@code <iframe>} can load media without an Authorization header. Expiry is rounded up to a 15-minute bucket so
 * URLs stay stable (and cacheable by browsers) for a while.
 */
@Component
public class MediaUrlSigner {

    private static final long BUCKET_SECONDS = 900;

    /** Signed media URLs embedded in HTML (attribute values may contain {@code &amp;}). */
    private static final Pattern EMBEDDED = Pattern.compile(
            "(?:https?://[^\\s\"'<>]*?)?/api/media/([0-9a-fA-F-]{36})/content\\?expires=(\\d{1,12})(&amp;|&)sig=([A-Za-z0-9_-]+)");

    private final AppProperties props;
    private final Clock clock;
    private final SecretKeySpec key;

    public MediaUrlSigner(AppProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
        this.key = new SecretKeySpec(props.media().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public String signedUrl(UUID mediaId, boolean download) {
        long expires = expiresAt();
        String base = stripTrailingSlash(props.publicBaseUrl());
        String url = base + "/api/media/" + mediaId + "/content?expires=" + expires + "&sig=" + sign(mediaId, expires);
        return download ? url + "&download=true" : url;
    }

    long expiresAt() {
        long target = clock.instant().getEpochSecond() + props.media().urlTtl().toSeconds();
        return ((target + BUCKET_SECONDS - 1) / BUCKET_SECONDS) * BUCKET_SECONDS;
    }

    public boolean isExpired(long expires) {
        return clock.instant().getEpochSecond() > expires;
    }

    public boolean isValid(UUID mediaId, long expires, String signature) {
        if (signature == null) {
            return false;
        }
        byte[] expected = sign(mediaId, expires).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, signature.getBytes(StandardCharsets.US_ASCII));
    }

    /**
     * Re-signs media URLs embedded in rich text (e.g. inline images) so they never expire for readers. Only URLs
     * carrying a genuine signature issued by this server are refreshed, so no one can mint URLs for foreign media.
     */
    public String refreshEmbeddedUrls(String html) {
        if (html == null || !html.contains("/api/media/")) {
            return html;
        }
        Matcher m = EMBEDDED.matcher(html);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String replacement = m.group();
            try {
                UUID id = UUID.fromString(m.group(1));
                long expires = Long.parseLong(m.group(2));
                if (isValid(id, expires, m.group(4))) {
                    long fresh = expiresAt();
                    replacement = stripTrailingSlash(props.publicBaseUrl()) + "/api/media/" + id + "/content?expires="
                            + fresh + m.group(3) + "sig=" + sign(id, fresh);
                }
            } catch (IllegalArgumentException ignored) {
                // leave untouched
            }
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString();
    }

    String sign(UUID mediaId, long expires) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            byte[] raw = mac.doFinal((mediaId + ":" + expires).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Unable to sign media URL", e);
        }
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
