package de.sprachweg.media;

import de.sprachweg.common.exception.BadRequestException;
import de.sprachweg.common.exception.ForbiddenException;
import de.sprachweg.common.exception.NotFoundException;
import de.sprachweg.user.User;
import de.sprachweg.user.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {

    private static final DateTimeFormatter PREFIX = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    private final MediaRepository repository;
    private final UserRepository users;
    private final FileStorage storage;
    private final MediaMapper mapper;
    private final MediaUrlSigner signer;
    private final Clock clock;

    public MediaService(MediaRepository repository, UserRepository users, FileStorage storage, MediaMapper mapper,
                        MediaUrlSigner signer, Clock clock) {
        this.repository = repository;
        this.users = users;
        this.storage = storage;
        this.mapper = mapper;
        this.signer = signer;
        this.clock = clock;
    }

    @Transactional
    public MediaDto upload(UUID ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("FILE_EMPTY", "Please choose a non-empty file");
        }
        try (InputStream in = file.getInputStream()) {
            return mapper.toDto(store(ownerId, file.getOriginalFilename(), file.getContentType(), in));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store upload", e);
        }
    }

    /** Stores content from any stream (also used by the seeder). */
    @Transactional
    public MediaAsset store(UUID ownerId, String originalName, String contentType, InputStream in) throws IOException {
        User owner = users.findById(ownerId).orElseThrow(() -> NotFoundException.of("User"));
        String name = FileNames.sanitize(originalName);
        String type = resolveContentType(contentType, name);
        Instant now = Instant.now(clock);
        String key = PREFIX.format(now) + "/" + UUID.randomUUID();
        long size = storage.store(key, in);
        registerRollbackCleanup(key);
        MediaAsset asset = new MediaAsset(owner, name, type, size, MediaKind.detect(type, name), key, now);
        return repository.save(asset);
    }

    static String resolveContentType(String declared, String fileName) {
        if (declared != null && !declared.isBlank() && !declared.equalsIgnoreCase(MediaType.APPLICATION_OCTET_STREAM_VALUE)) {
            try {
                return MediaType.parseMediaType(declared).toString();
            } catch (Exception ignored) {
                // fall through to extension based detection
            }
        }
        return MediaTypeFactory.getMediaType(fileName).map(MediaType::toString)
                .orElse(MediaType.APPLICATION_OCTET_STREAM_VALUE);
    }

    @Transactional(readOnly = true)
    public MediaDto get(UUID id, UUID userId, boolean admin) {
        return mapper.toDto(requireUsable(id, userId, admin));
    }

    /** Returns a media asset the user owns (or any asset for admins); 404 otherwise. */
    @Transactional(readOnly = true)
    public MediaAsset requireUsable(UUID id, UUID userId, boolean admin) {
        MediaAsset asset = repository.findById(id).orElseThrow(() -> NotFoundException.of("Media"));
        if (!admin && !asset.getOwner().getId().equals(userId)) {
            throw NotFoundException.of("Media");
        }
        return asset;
    }

    @Transactional
    public void delete(UUID id, UUID userId, boolean admin) {
        MediaAsset asset = requireUsable(id, userId, admin);
        String key = asset.getStorageKey();
        repository.delete(asset);
        repository.flush();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(key);
            }
        });
    }

    public record MediaContent(MediaAsset asset, Resource resource) {
    }

    @Transactional(readOnly = true)
    public MediaContent openSigned(UUID id, long expires, String sig) {
        if (!signer.isValid(id, expires, sig)) {
            throw new ForbiddenException("INVALID_SIGNATURE", "The media link is invalid");
        }
        if (signer.isExpired(expires)) {
            throw new ForbiddenException("LINK_EXPIRED", "The media link has expired");
        }
        MediaAsset asset = repository.findById(id).orElseThrow(() -> NotFoundException.of("Media"));
        Resource resource = storage.load(asset.getStorageKey());
        if (!resource.exists()) {
            throw NotFoundException.of("Media");
        }
        return new MediaContent(asset, resource);
    }

    private void registerRollbackCleanup(String key) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        storage.delete(key);
                    }
                }
            });
        }
    }
}
