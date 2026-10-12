package me.amanullah.course.media;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.ForbiddenException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.config.StorageQuotaProperties;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
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
    private final StorageQuotaProperties quotas;

    public MediaService(MediaRepository repository, UserRepository users, FileStorage storage, MediaMapper mapper,
                        MediaUrlSigner signer, Clock clock, StorageQuotaProperties quotas) {
        this.repository = repository;
        this.users = users;
        this.storage = storage;
        this.mapper = mapper;
        this.signer = signer;
        this.clock = clock;
        this.quotas = quotas;
    }

    /**
     * Upload by a user: checks the type rules ({@link FileTypePolicy}: allow-list for students, no executables for
     * anyone) and the storage quota (413 QUOTA_EXCEEDED) before storing.
     */
    @Transactional
    public MediaDto upload(UUID ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("FILE_EMPTY", "Please choose a non-empty file");
        }
        User owner = users.findById(ownerId).orElseThrow(() -> NotFoundException.of("User"));
        String name = FileNames.sanitize(file.getOriginalFilename());
        try {
            String verifiedType = FileTypePolicy.check(owner.getRole(), name, file.getContentType(), file::getInputStream);
            Long quota = quotaBytes(owner.getRole());
            if (quota != null) {
                long used = repository.sumSizeByOwner(ownerId);
                if (used + file.getSize() > quota) {
                    throw new QuotaExceededException(used, quota, file.getSize());
                }
            }
            try (InputStream in = file.getInputStream()) {
                return mapper.toDto(store(ownerId, name, verifiedType != null ? verifiedType : file.getContentType(), in));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store upload", e);
        }
    }

    /** Bytes used by the user's media and their quota ({@code null} = unlimited). */
    @Transactional(readOnly = true)
    public StorageUsage usage(UUID userId, Role role) {
        return new StorageUsage(repository.sumSizeByOwner(userId), quotaBytes(role));
    }

    /** Storage quota of a role; admins are unlimited ({@code null}). */
    public Long quotaBytes(Role role) {
        return switch (role) {
            case ADMIN -> null;
            case INSTRUCTOR -> quotas.instructor().toBytes();
            case STUDENT -> quotas.student().toBytes();
        };
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
                String parsed = MediaType.parseMediaType(declared).toString();
                if (parsed.length() <= 150) {
                    return parsed;
                }
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

    /** The kind of a media asset, or {@code null} when it does not exist (used to validate question definitions). */
    @Transactional(readOnly = true)
    public MediaKind kindOf(UUID id) {
        return repository.findById(id).map(MediaAsset::getKind).orElse(null);
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
