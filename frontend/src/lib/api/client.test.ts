import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResponse } from "./types";

type Client = typeof import("./client");

const API = "http://api.test";

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json", ...headers },
  });
}

function session(token: string, expiresIn = 900): AuthResponse {
  return {
    accessToken: token,
    expiresIn,
    user: { id: "u1", fullName: "Luca Rossi", email: "student@sprachweg.de", role: "STUDENT" },
  } as unknown as AuthResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const authHeader = (init?: RequestInit) => (init?.headers as Record<string, string> | undefined)?.Authorization;

describe("api client", () => {
  let client: Client;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Fresh module state (in-memory token, single-flight promise) for every test.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", `${API}/`);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = await import("./client");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("refreshSession (single-flight)", () => {
    it("shares one refresh request between concurrent callers", async () => {
      const response = deferred<Response>();
      fetchMock.mockReturnValueOnce(response.promise);

      const first = client.refreshSession();
      const second = client.refreshSession();
      expect(second).toBe(first);
      response.resolve(json(200, session("fresh")));

      await expect(Promise.all([first, second])).resolves.toEqual([session("fresh"), session("fresh")]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${API}/api/auth/refresh`);
      expect(init).toMatchObject({ method: "POST", credentials: "include" });
      expect(client.getAccessToken()).toBe("fresh");
      expect(client.hasSessionHint()).toBe(true);
    });

    it("starts a new request once the previous one has settled", async () => {
      fetchMock.mockResolvedValueOnce(json(200, session("one"))).mockResolvedValueOnce(json(200, session("two")));
      await client.refreshSession();
      await client.refreshSession();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(client.getAccessToken()).toBe("two");
    });

    it("ends the session when the refresh cookie is rejected", async () => {
      client.setSession(session("old"));
      const listener = vi.fn();
      client.onSessionChange(listener);
      fetchMock.mockResolvedValueOnce(json(401, { code: "INVALID_REFRESH_TOKEN" }));

      await expect(client.refreshSession()).resolves.toBeNull();
      expect(client.getAccessToken()).toBeNull();
      expect(client.hasSessionHint()).toBe(false);
      expect(listener).toHaveBeenCalledWith(null);
      expect(client.consumeSessionEnded()).toBe(true);
      expect(client.consumeSessionEnded()).toBe(false);
      expect(client.lastRefreshUnavailable()).toBe(false);
    });

    it("keeps the session hint when the API is down (5xx or network error)", async () => {
      client.setSession(session("old"));
      fetchMock.mockResolvedValueOnce(json(503, {}));
      await expect(client.refreshSession()).resolves.toBeNull();
      expect(client.lastRefreshUnavailable()).toBe(true);
      expect(client.hasSessionHint()).toBe(true);
      expect(client.consumeSessionEnded()).toBe(false);

      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await expect(client.refreshSession()).resolves.toBeNull();
      expect(client.lastRefreshUnavailable()).toBe(true);
      expect(client.hasSessionHint()).toBe(true);
    });
  });

  describe("apiFetch", () => {
    it("sends JSON, the bearer token and Accept-Language", async () => {
      client.setSession(session("token-1"));
      client.setApiLocale("de");
      fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

      await expect(client.api.post("/api/things", { a: 1 }, { query: { q: "x", empty: "", none: undefined } })).resolves.toEqual({
        ok: true,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${API}/api/things?q=x`);
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ a: 1 }));
      expect(init.headers).toMatchObject({
        Authorization: "Bearer token-1",
        "Accept-Language": "de",
        "Content-Type": "application/json",
      });
    });

    it("does not attach the token for auth: false requests", async () => {
      client.setSession(session("token-1"));
      fetchMock.mockResolvedValueOnce(json(200, []));
      await client.api.get("/api/public/courses", undefined, { auth: false });
      expect(authHeader(fetchMock.mock.calls[0][1])).toBeUndefined();
    });

    it("refreshes once on 401 and retries with the new token", async () => {
      client.setSession(session("expired"));
      fetchMock
        .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED" }))
        .mockResolvedValueOnce(json(200, session("renewed")))
        .mockResolvedValueOnce(json(200, { id: "me" }));

      await expect(client.api.get("/api/users/me")).resolves.toEqual({ id: "me" });
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        `${API}/api/users/me`,
        `${API}/api/auth/refresh`,
        `${API}/api/users/me`,
      ]);
      expect(authHeader(fetchMock.mock.calls[0][1])).toBe("Bearer expired");
      expect(authHeader(fetchMock.mock.calls[2][1])).toBe("Bearer renewed");
    });

    it("uses a single refresh for concurrent 401 responses", async () => {
      client.setSession(session("expired"));
      const refresh = deferred<Response>();
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/refresh")) return refresh.promise;
        return Promise.resolve(
          authHeader(init) === "Bearer renewed" ? json(200, { url }) : json(401, { code: "UNAUTHORIZED" }),
        );
      });

      const results = Promise.all([client.api.get("/api/a"), client.api.get("/api/b"), client.api.get("/api/c")]);
      await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u.endsWith("/refresh"))).toHaveLength(1));
      refresh.resolve(json(200, session("renewed")));

      await expect(results).resolves.toEqual([{ url: `${API}/api/a` }, { url: `${API}/api/b` }, { url: `${API}/api/c` }]);
      expect(fetchMock.mock.calls.filter(([u]) => u.endsWith("/api/auth/refresh"))).toHaveLength(1);
    });

    it("throws the 401 when the refresh fails (no retry loop)", async () => {
      client.setSession(session("expired"));
      fetchMock
        .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED", detail: "Please log in to continue." }))
        .mockResolvedValueOnce(json(401, { code: "INVALID_REFRESH_TOKEN" }));

      const error = await client.api.get("/api/users/me").catch((e: unknown) => e);
      expect(client.isApiError(error)).toBe(true);
      expect(error).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("refreshes proactively when the access token is about to expire", async () => {
      client.setSession(session("almost-expired", 10));
      fetchMock.mockResolvedValueOnce(json(200, session("renewed"))).mockResolvedValueOnce(json(200, {}));
      await client.api.get("/api/users/me");
      expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/auth/refresh`);
      expect(authHeader(fetchMock.mock.calls[1][1])).toBe("Bearer renewed");
    });

    it("parses problem details into ApiError", async () => {
      fetchMock.mockResolvedValueOnce(
        json(400, {
          title: "Bad Request",
          status: 400,
          detail: "Some fields are invalid.",
          code: "VALIDATION_FAILED",
          errors: { email: "must be a well-formed email address" },
        }),
      );
      const error = await client.api.post("/api/auth/register", {}, { auth: false }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(client.ApiError);
      expect(error).toMatchObject({
        status: 400,
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid.",
        fieldErrors: { email: "must be a well-formed email address" },
      });
    });

    it("keeps the traceId of server errors and truncates non-JSON bodies", async () => {
      fetchMock.mockResolvedValueOnce(json(500, { code: "INTERNAL_ERROR", traceId: "abc" }));
      await expect(client.api.get("/api/x")).rejects.toMatchObject({ status: 500, traceId: "abc" });

      fetchMock.mockResolvedValueOnce(new Response("x".repeat(1000), { status: 502, headers: { "content-type": "text/html" } }));
      const error = (await client.api.get("/api/x").catch((e: unknown) => e)) as InstanceType<Client["ApiError"]>;
      expect(error.status).toBe(502);
      expect(error.detail).toHaveLength(300);
    });

    it("turns network failures into ApiError(0, NETWORK_ERROR)", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const error = (await client.api.get("/api/x").catch((e: unknown) => e)) as InstanceType<Client["ApiError"]>;
      expect(error.isNetworkError).toBe(true);
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("re-throws aborts unchanged", async () => {
      fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
      await expect(client.api.get("/api/x")).rejects.toMatchObject({ name: "AbortError" });
    });

    it("returns undefined for 204 and empty bodies", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(client.api.delete("/api/x")).resolves.toBeUndefined();
      fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
      await expect(client.api.get("/api/x")).resolves.toBeUndefined();
    });
  });

  describe("helpers", () => {
    it("strips trailing slashes from the API URL and builds query strings", () => {
      expect(client.API_URL).toBe(API);
      expect(client.buildUrl("/api/public/courses", { q: "deutsch a1", level: "A1", page: 0, empty: "", n: null })).toBe(
        `${API}/api/public/courses?q=deutsch+a1&level=A1&page=0`,
      );
      expect(client.buildUrl("https://cdn.example.org/file")).toBe("https://cdn.example.org/file");
    });

    it("getErrorMessage prefers the error message", () => {
      expect(client.getErrorMessage(new client.ApiError(400, { detail: "Nope" }))).toBe("Nope");
      expect(client.getErrorMessage(new Error("boom"))).toBe("boom");
      expect(client.getErrorMessage(42, "fallback")).toBe("fallback");
    });
  });
});
