package me.amanullah.course.user;

import me.amanullah.course.auth.RefreshTokenService;
import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;
    private final UserMapper mapper;
    private final MediaService mediaService;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokens;

    public UserService(UserRepository users, UserMapper mapper, MediaService mediaService,
                       PasswordEncoder passwordEncoder, RefreshTokenService refreshTokens) {
        this.users = users;
        this.mapper = mapper;
        this.mediaService = mediaService;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokens = refreshTokens;
    }

    @Transactional(readOnly = true)
    public User require(UUID id) {
        return users.findById(id).orElseThrow(() -> NotFoundException.of("User"));
    }

    @Transactional(readOnly = true)
    public UserDto getMe(UUID id) {
        return mapper.toDto(require(id));
    }

    @Transactional
    public UserDto updateProfile(UUID id, UserController.UpdateProfileRequest request) {
        User user = require(id);
        user.setFullName(request.fullName().trim());
        user.setBio(request.bio() == null || request.bio().isBlank() ? null : request.bio().trim());
        if (request.avatarMediaId() == null) {
            user.setAvatar(null);
        } else {
            MediaAsset avatar = mediaService.requireUsable(request.avatarMediaId(), id, false);
            if (avatar.getKind() != MediaKind.IMAGE) {
                throw new BadRequestException("AVATAR_NOT_IMAGE", "The avatar must be an image");
            }
            user.setAvatar(avatar);
        }
        return mapper.toDto(user);
    }

    @Transactional
    public void changeLocale(UUID id, String locale) {
        require(id).setLocale(locale);
    }

    @Transactional
    public void changePassword(UUID id, UserController.ChangePasswordRequest request, HttpServletRequest http) {
        User user = require(id);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("INVALID_PASSWORD", "The current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        refreshTokens.revokeAllExceptCurrent(user, http);
    }
}
