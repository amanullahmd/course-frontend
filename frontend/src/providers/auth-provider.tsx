"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { hasSessionHint, onSessionChange, refreshSession, setSession } from "@/lib/api/client";
import { meApi } from "@/lib/api/me";
import type { AuthResponse, RegisterRequest, UserDto } from "@/lib/api/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<UserDto>;
  register: (body: RegisterRequest) => Promise<string>;
  logout: () => Promise<void>;
  /** Replace the cached user (e.g. after a profile update). */
  setUser: (user: UserDto) => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

// One silent refresh per page load, shared across StrictMode double-mounts.
let bootstrap: Promise<AuthResponse | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = React.useState<UserDto | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  React.useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setUserState(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
    });
    bootstrap ??= hasSessionHint() ? refreshSession() : Promise.resolve(null);
    let active = true;
    bootstrap.then((session) => {
      if (!active) return;
      setUserState(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      queryClient.clear();
      setSession(session);
      return session.user;
    },
    [queryClient],
  );

  const register = React.useCallback(async (body: RegisterRequest) => {
    const res = await authApi.register(body);
    return res.message;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the session is cleared locally regardless */
    }
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const reloadUser = React.useCallback(async () => {
    const fresh = await meApi.get();
    setUserState(fresh);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, setUser: setUserState, reloadUser }),
    [user, status, login, register, logout, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
