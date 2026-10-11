package me.amanullah.course.user;

import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Me")
@RestController
@RequestMapping("/api/users/me")
public class UserController {

    public record UpdateProfileRequest(@NotBlank @Size(max = 120) String fullName,
                                       @Size(max = 2000) String bio,
                                       UUID avatarMediaId) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8, max = 128)
                                        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
                                        String newPassword) {
    }

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public UserDto me() {
        return userService.getMe(CurrentUser.get().id());
    }

    @PutMapping
    public UserDto update(@Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(CurrentUser.get().id(), request);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                               HttpServletRequest http) {
        userService.changePassword(CurrentUser.get().id(), request, http);
        return ResponseEntity.noContent().build();
    }
}
