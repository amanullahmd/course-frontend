package me.amanullah.course.media;

import org.springframework.stereotype.Component;

@Component
public class MediaMapper {

    private final MediaUrlSigner signer;

    public MediaMapper(MediaUrlSigner signer) {
        this.signer = signer;
    }

    public MediaDto toDto(MediaAsset m) {
        if (m == null) {
            return null;
        }
        return new MediaDto(m.getId(), m.getOriginalName(), m.getContentType(), m.getSizeBytes(), m.getKind(),
                signer.signedUrl(m.getId(), false), signer.signedUrl(m.getId(), true), m.getCreatedAt());
    }

    public String url(MediaAsset m) {
        return m == null ? null : signer.signedUrl(m.getId(), false);
    }
}
