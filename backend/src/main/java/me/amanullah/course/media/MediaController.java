package me.amanullah.course.media;

import me.amanullah.course.config.AppProperties;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.security.RateLimiter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Media")
@RestController
@RequestMapping("/api/media")
public class MediaController {

    /** Types that could execute script when rendered inline from the API origin: always served as attachment. */
    private static final Set<String> ACTIVE_TYPES = Set.of("text/html", "application/xhtml+xml", "image/svg+xml",
            "text/javascript", "application/javascript", "application/xml", "text/xml");

    private final MediaService mediaService;
    private final RateLimiter rateLimiter;
    private final String frameAncestors;

    public MediaController(MediaService mediaService, RateLimiter rateLimiter, AppProperties props) {
        this.mediaService = mediaService;
        this.rateLimiter = rateLimiter;
        this.frameAncestors = "frame-ancestors 'self' " + String.join(" ", props.cors().allowedOrigins());
    }

    /**
     * multipart/form-data with a {@code file} part; anything else → 400 FILE_REQUIRED. Rate limited per user
     * (429), checked against the type rules (415 FILE_TYPE_NOT_ALLOWED) and the storage quota (413 QUOTA_EXCEEDED).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MediaDto upload(@RequestPart("file") MultipartFile file) {
        UUID me = CurrentUser.get().id();
        rateLimiter.consumeUser(RateLimiter.Limit.UPLOAD_USER, me);
        return mediaService.upload(me, file);
    }

    /** Storage used by the caller's uploads and their quota ({@code quotaBytes} null = unlimited). */
    @GetMapping("/usage")
    public StorageUsage usage() {
        CurrentUser me = CurrentUser.get();
        return mediaService.usage(me.id(), me.role());
    }

    @GetMapping("/{id}")
    public MediaDto get(@PathVariable UUID id) {
        CurrentUser me = CurrentUser.get();
        return mediaService.get(id, me.id(), me.isAdmin());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        CurrentUser me = CurrentUser.get();
        mediaService.delete(id, me.id(), me.isAdmin());
        return ResponseEntity.noContent().build();
    }

    /** Streams the file. Spring MVC serves {@code Range} requests (206 Partial Content) for {@link Resource} bodies. */
    @GetMapping("/{id}/content")
    public ResponseEntity<Resource> content(@PathVariable UUID id, @RequestParam long expires,
                                            @RequestParam String sig,
                                            @RequestParam(defaultValue = "false") boolean download) {
        MediaService.MediaContent content = mediaService.openSigned(id, expires, sig);
        MediaAsset asset = content.asset();
        MediaType type;
        try {
            type = MediaType.parseMediaType(asset.getContentType());
        } catch (Exception e) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        boolean active = ACTIVE_TYPES.contains((type.getType() + "/" + type.getSubtype()).toLowerCase(Locale.ROOT))
                || FileTypePolicy.isActive(asset.getOriginalName(), asset.getContentType());
        boolean attachment = download || active;
        if (active) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        } else if ("text".equalsIgnoreCase(type.getType()) && type.getCharset() == null) {
            // Without a charset browsers fall back to windows-1252 and garble umlauts (e.g. "TschÃ¼ss").
            type = new MediaType(type, java.nio.charset.StandardCharsets.UTF_8);
        }
        // Inline content is sandboxed (no scripts, unique origin) in case a file is opened directly. PDFs are the
        // exception: browsers refuse to run their built-in PDF viewer inside a sandboxed document.
        boolean pdf = "application".equalsIgnoreCase(type.getType()) && "pdf".equalsIgnoreCase(type.getSubtype());
        String csp = attachment || pdf ? frameAncestors : "sandbox; " + frameAncestors;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, FileNames.contentDisposition(asset.getOriginalName(), attachment))
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", csp)
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .body(content.resource());
    }
}
