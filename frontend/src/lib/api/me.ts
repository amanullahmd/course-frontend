import { api } from "./client";
import type { ChangePasswordRequest, UpdateProfileRequest, UserDto } from "./types";

export const meApi = {
  get: () => api.get<UserDto>("/api/users/me"),
  update: (body: UpdateProfileRequest) => api.put<UserDto>("/api/users/me", body),
  changePassword: (body: ChangePasswordRequest) => api.put<void>("/api/users/me/password", body),
};
