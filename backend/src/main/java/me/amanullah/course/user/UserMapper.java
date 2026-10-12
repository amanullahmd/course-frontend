package me.amanullah.course.user;

import me.amanullah.course.media.MediaUrlSigner;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    private final MediaUrlSigner signer;

    public UserMapper(MediaUrlSigner signer) {
        this.signer = signer;
    }

    public UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.isEmailVerified(), u.getBio(),
                avatarUrl(u), u.getAvatar() == null ? null : u.getAvatar().getId(), u.getLocale(), u.getCreatedAt(),
                u.getInstructorStatus());
    }

    public UserSummaryDto toSummary(User u) {
        return new UserSummaryDto(u.getId(), u.getFullName(), u.getEmail(), avatarUrl(u));
    }

    public String avatarUrl(User u) {
        return u.getAvatar() == null ? null : signer.signedUrl(u.getAvatar().getId(), false);
    }
}
