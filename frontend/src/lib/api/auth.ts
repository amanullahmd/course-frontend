import { api } from "./client";
import type { AuthResponse, LoginRequest, MessageResponse, RegisterRequest } from "./types";

const noAuth = { auth: false } as const;

export const authApi = {
  register: (body: RegisterRequest) => api.post<MessageResponse>("/api/auth/register", body, noAuth),
  verifyEmail: (token: string) => api.post<MessageResponse>("/api/auth/verify-email", { token }, noAuth),
  resendVerification: (email: string) =>
    api.post<MessageResponse>("/api/auth/resend-verification", { email }, noAuth),
  login: (body: LoginRequest) => api.post<AuthResponse>("/api/auth/login", body, noAuth),
  logout: () => api.post<void>("/api/auth/logout", undefined, noAuth),
  forgotPassword: (email: string) => api.post<MessageResponse>("/api/auth/forgot-password", { email }, noAuth),
  resetPassword: (token: string, password: string) =>
    api.post<MessageResponse>("/api/auth/reset-password", { token, password }, noAuth),
};
