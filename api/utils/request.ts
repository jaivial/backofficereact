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
 * The Go backend answers unknown `/admin/*` routes with the SPA shell (200 +
 * text/html) instead of a 404, so readJSON would silently resolve to null and
 * every caller doing `res.success` would throw a raw TypeError. Turn that case
 * into a controlled error carrying the path that has no JSON endpoint.
 * Coord id: admin_html_fallback_guard_v1
 */
export function assertJsonResponse(res: Response, path: string): void {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (res.ok && contentType.includes("text/html")) {
    // Solo la ruta: la query puede llevar terminos de busqueda o tokens de acceso
    // (p. ej. /api/public/invoices/{id}?token=...) que no deben pintarse en la UI.
    throw new Error(`Respuesta no válida del servidor (no JSON) en ${path.split("?")[0]}`);
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
    assertJsonResponse(res, path);
    const data = await readJSON(res);
    emitSessionExpirationUpdate(
      (data as any)?.moving_expiration_date ?? res.headers.get("x-moving-expiration-date")
    );
    if (res.status === 401) {
      emitSessionExpired();
    }
    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      // The body often carries a machine code and figures (e.g. the POS
      // DISCREPANCY_REASON_REQUIRED answer brings expectedCashCents); keep it
      // so callers can act on it instead of parsing English prose.
      throw new APIResponseError(msg, res.status, data);
    }
    return data as T;
  };
}

/** Non-2xx JSON answer. `body` is the parsed payload (may be null). */
export class APIResponseError extends Error {
  readonly status: number;
  readonly body: any;
  readonly code: string;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "APIResponseError";
    this.status = status;
    this.body = body ?? null;
    this.code = typeof body?.code === "string" ? body.code : "";
  }
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
