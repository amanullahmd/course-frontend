package de.sprachweg.media;

import de.sprachweg.config.AppProperties;
import de.sprachweg.security.CurrentUser;
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
    private final String frameAncestors;

    public MediaController(MediaService mediaService, AppProperties props) {
        this.mediaService = mediaService;
        this.frameAncestors = "frame-ancestors 'self' " + String.join(" ", props.cors().allowedOrigins());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MediaDto upload(@RequestPart("file") MultipartFile file) {
        return mediaService.upload(CurrentUser.get().id(), file);
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
        boolean active = ACTIVE_TYPES.contains((type.getType() + "/" + type.getSubtype()).toLowerCase(Locale.ROOT));
        boolean attachment = download || active;
        if (active) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, FileNames.contentDisposition(asset.getOriginalName(), attachment))
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header("Content-Security-Policy", frameAncestors)
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .body(content.resource());
    }
}
