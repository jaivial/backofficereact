/**
 * API Request Utilities
 * Core HTTP request handling functions for the API client
 */

import { emitSessionExpired, emitSessionExpirationUpdate } from "../../lib/session-expiration";

/**
 * Check if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Read and parse JSON from response, handling empty responses
 */
export async function readJSON(res: Response): Promise<any> {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

/**
 * Normalize admin API paths to include /api prefix
 */
export function normalizeAdminPath(path: string): string {
  if (path === "/admin") return "/api/admin";
  if (path.startsWith("/admin/")) return `/api${path}`;
  return path;
}

/**
 * Build URL with query parameters
 */
export function withQuery(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    q.set(key, String(value));
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Client options for creating API client
 */
export type ClientOpts = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  cookieHeader?: string;
  timeoutMs?: number;
};

/**
 * Normalized client options with defaults applied
 */
export type NormalizedClientOpts = Required<Pick<ClientOpts, "baseUrl" | "fetchImpl" | "cookieHeader" | "timeoutMs">>;

/**
 * Create normalized client options with defaults
 */
export function normalizeClientOpts(opts: ClientOpts = { baseUrl: "" }): NormalizedClientOpts {
  return {
    baseUrl: opts?.baseUrl?.replace(/\/+$/, "") ?? "",
    fetchImpl: opts?.fetchImpl ?? fetch,
    cookieHeader: opts?.cookieHeader ?? "",
    timeoutMs: opts?.timeoutMs ?? (isBrowser() ? 0 : 8_000),
  };
}

/**
 * Create the base API fetch function with authentication and error handling
 */
export function createApiFetch(normalizedOpts: NormalizedClientOpts) {
  const { fetchImpl, baseUrl, cookieHeader, timeoutMs } = normalizedOpts;

  return async function apiFetch(path: string, init: RequestInit): Promise<Response> {
    const url = baseUrl + normalizeAdminPath(path);
    const headers = new Headers(init.headers ?? {});

    if (!isBrowser()) {
      if (cookieHeader) headers.set("cookie", cookieHeader);
    }
    // Browser: always include cookies (same-origin via /api proxy).
    const withCreds = isBrowser() ? { credentials: "include" as RequestCredentials } : {};

    return fetchImpl(url, {
      ...init,
      ...withCreds,
      headers,
      signal: init.signal ?? (timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined),
    });
  };
}

/**
 * Create JSON request function with session handling
 */
export function createJsonRequest(apiFetch: ReturnType<typeof createApiFetch>) {
  return async function json<T>(path: string, init: RequestInit): Promise<T> {
    const res = await apiFetch(path, init);
    const data = await readJSON(res);
    emitSessionExpirationUpdate(
      (data as any)?.moving_expiration_date ?? res.headers.get("x-moving-expiration-date")
    );
    if (res.status === 401) {
      emitSessionExpired();
    }
    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  };
}

/**
 * Type alias for JSON request function
 */
export type JsonRequestFn = ReturnType<typeof createJsonRequest>;

/**
 * Type alias for withQuery function
 */
export type WithQueryFn = typeof withQuery;

/**
 * Create JSON request with fallback paths (tries multiple endpoints in order)
 */
export function createJsonWithFallback(json: ReturnType<typeof createJsonRequest>) {
  return async function jsonWithFallback<T>(paths: string[], init: RequestInit): Promise<T> {
    let lastError: Error | null = null;
    for (const path of paths) {
      try {
        return await json<T>(path, init);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");
      }
    }
    throw lastError ?? new Error("No endpoint available");
  };
}
