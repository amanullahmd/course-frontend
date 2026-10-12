import { safeNextPath } from "@/lib/utils";

/**
 * Remembers where to continue after sign-up (e.g. `/courses/<slug>` from an invitation link), because the
 * verification e-mail link cannot carry it. Only relative paths are kept; storage failures are ignored.
 */
const KEY = "sprachweg.postAuthNext";

export function rememberNext(next: string | null | undefined) {
  const safe = safeNextPath(next, "");
  try {
    if (safe) window.localStorage.setItem(KEY, safe);
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}

export function rememberedNext(): string | null {
  try {
    return safeNextPath(window.localStorage.getItem(KEY), "") || null;
  } catch {
    return null;
  }
}

/** `/login`, continuing to `next` (if it is a safe relative path). */
export function loginHref(next: string | null | undefined) {
  const safe = safeNextPath(next, "");
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
