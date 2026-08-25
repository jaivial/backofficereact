import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

// Prevent vike from treating test/spec files as route files. Vike crawls every
// script file whose basename starts with "+" (e.g. `+data.ts`) and loads it as
// a "value file". A stray `+data.test.ts` (or any `+*.test.*` / `+*.spec.*`)
// would then be imported during SSR and crash the page with a 500 — e.g. a
// test importing `vitest` throws "Vitest failed to access its internal state".
// vike reads VIKE_CRAWL at config-resolution time, so set it before any
// renderPage/dev-middleware runs. Only set when absent: an explicit VIKE_CRAWL
// (docker-compose, CI) is respected as-is.
import { defaultVikeCrawl } from "./vikeCrawl";

if (!process.env.VIKE_CRAWL) {
  process.env.VIKE_CRAWL = JSON.stringify(defaultVikeCrawl());
}

const MOBILE_UA_REGEX = /(android|iphone|ipad|ipod|mobile|webos|blackberry|windows phone)/i;

function isMobileUA(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA_REGEX.test(userAgent);
}

import express from "express";
import { createServer as createViteServer } from "vite";
import { renderPage } from "vike/server";
import { WebSocket, WebSocketServer } from "ws";
import {
  filterBOSessionCookie,
  filterBOSessionSetCookies,
  sessionCacheKey,
  sessionTokenFromCookie,
} from "../lib/http/cookies";
import { readSetCookies } from "../lib/http/readSetCookies";
import { firstAllowedPath, isPathAllowed } from "../lib/rbac";
import { requestScheme } from "../lib/http/request-scheme";

type BOUser = {
  id: number;
  email: string;
  username?: string | null;
  name: string;
  role: string;
  roleImportance: number;
  sectionAccess: string[];
  mustChangePassword?: boolean;
};

type BORestaurant = {
  id: number;
  slug: string;
  name: string;
};

type BOSession = {
  user: BOUser;
  restaurants: BORestaurant[];
  activeRestaurantId: number;
};

type BOPageContext = {
  theme: "dark" | "light";
  session: BOSession | null;
  movingExpirationDate?: string | null;
  isMobile?: boolean;
};

const LOCAL_BACKEND_START_CMD = "cd ../backend && go run ./cmd/server";
const backendHelpLogged = new Set<string>();
const SSR_DEBUG = process.env.SSR_DEBUG === "1";
const SESSION_FETCH_TIMEOUT_MS = 2_500;
const API_PROXY_BODY_LIMIT_BYTES = 32 * 1024 * 1024;

// Session cache: server-side only, no client exposure
// TTL: 30 seconds to balance freshness vs performance
const SESSION_CACHE_TTL_MS = 30_000;
type SessionCacheEntry = {
  session: BOSession | null;
  movingExpirationDate: string | null;
  setCookies: string[];
  expiresAt: number;
};
const sessionCache = new Map<string, SessionCacheEntry>();
const sessionFetches = new Map<string, Promise<FetchSessionResult>>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionCache) {
    if (entry.expiresAt <= now) {
      sessionCache.delete(key);
    }
  }
}, SESSION_CACHE_TTL_MS);

function isBackendConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const errorLike = err as {
    code?: unknown;
    errno?: unknown;
    message?: unknown;
    cause?: { message?: unknown } | null;
  };

  const code = typeof errorLike.code === "string" ? errorLike.code.toUpperCase() : "";
  if (code === "ECONNREFUSED" || code === "ERR_CONNECTION_REFUSED") {
    return true;
  }

  if (typeof errorLike.errno === "number" && errorLike.errno === 0) {
    const message = typeof errorLike.message === "string" ? errorLike.message.toLowerCase() : "";
    if (message.includes("unable to connect")) return true;
  }

  const message = typeof errorLike.message === "string" ? errorLike.message.toLowerCase() : "";
  if (message.includes("econnrefused") || message.includes("connectionrefused") || message.includes("connection refused")) {
    return true;
  }

  const causeMessage = typeof errorLike.cause?.message === "string" ? errorLike.cause.message.toLowerCase() : "";
  if (causeMessage.includes("econnrefused") || causeMessage.includes("connection refused")) {
    return true;
  }

  return false;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const errorLike = err as { name?: unknown; code?: unknown };
  return errorLike.name === "AbortError" || errorLike.name === "TimeoutError" || errorLike.code === "ABORT_ERR";
}

function proxyTimeoutForPath(pathname: string): number {
  const path = pathname.toLowerCase();
  if (path.includes("/ai") || path.includes("/generate")) return 10 * 60_000;
  if (path.includes("/image") || path.includes("/import") || path.includes("/documents")) return 2 * 60_000;
  return 30_000;
}

function upstreamSignal(req: express.Request, res: express.Response, timeoutMs: number): AbortSignal {
  const disconnected = new AbortController();
  req.once("aborted", () => disconnected.abort());
  res.once("close", () => {
    if (!res.writableFinished) disconnected.abort();
  });
  return AbortSignal.any([disconnected.signal, AbortSignal.timeout(timeoutMs)]);
}

function logBackendUnavailable(scope: string, backendOrigin: string, err?: unknown): void {
  const key = `${scope}|${backendOrigin}`;
  if (backendHelpLogged.has(key)) return;
  backendHelpLogged.add(key);

  console.error(`[backoffice] ${scope}: backend unreachable at ${backendOrigin}`);
  console.error(`[backoffice] local dev (sin Docker): run \`${LOCAL_BACKEND_START_CMD}\``);

  if (!err || typeof err !== "object") return;
  const errorLike = err as { code?: unknown; path?: unknown };
  const code = typeof errorLike.code === "string" ? errorLike.code : "";
  const pathValue = typeof errorLike.path === "string" ? errorLike.path : "";
  const meta = [code ? `code=${code}` : "", pathValue ? `path=${pathValue}` : ""].filter(Boolean).join(" ");
  if (meta) {
    console.error(`[backoffice] ${scope}: ${meta}`);
  }
}

async function isBackendReachable(backendOrigin: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const url = new URL("/healthz", backendOrigin);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function readTLSFile(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function resolveAppPath(baseDir: string, p: string): string {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  return path.resolve(baseDir, p);
}

async function readRequestBody(req: express.Request, maxBytes = API_PROXY_BODY_LIMIT_BYTES): Promise<Buffer> {
  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const it = req as any as AsyncIterable<any>;
  for await (const chunk of it) {
    if (chunk === null || chunk === undefined) continue;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

type FetchSessionResult = {
  status: "authenticated" | "unauthenticated" | "unavailable";
  session: BOSession | null;
  movingExpirationDate: string | null;
  setCookies: string[];
};

function normalizeMovingExpirationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sessionSecurityScope(pagePath: string | undefined): "high" | "normal" {
  const path = String(pagePath ?? "").toLowerCase();
  return path.startsWith("/app/facturas") || path.startsWith("/app/estado-cuenta") ? "high" : "normal";
}

async function fetchSession(
  backendOrigin: string,
  cookieHeader: string | undefined,
  pagePath: string | undefined,
  publicScheme: "http" | "https",
): Promise<FetchSessionResult> {
  const sessionToken = sessionTokenFromCookie(cookieHeader);
  if (!sessionToken) {
    return { status: "unauthenticated", session: null, movingExpirationDate: null, setCookies: [] };
  }

  const cacheKey = `${sessionCacheKey(sessionToken)}:${sessionSecurityScope(pagePath)}`;
  const now = Date.now();

  // Check cache first
  const cached = sessionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      status: cached.session ? "authenticated" : "unauthenticated",
      session: cached.session,
      movingExpirationDate: cached.movingExpirationDate,
      setCookies: [],
    };
  }

  const pending = sessionFetches.get(cacheKey);
  if (pending) return pending;

  const request = (async (): Promise<FetchSessionResult> => {
    // Cache miss or expired - fetch fresh from backend
    try {
    const url = new URL("/api/admin/me", backendOrigin);
    const headers: Record<string, string> = {
      cookie: `bo_session=${sessionToken}`,
      "x-forwarded-proto": publicScheme,
    };
    if (typeof pagePath === "string" && pagePath.trim() !== "") {
      headers["x-bo-page-path"] = pagePath.trim();
    }
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS),
    });
    const setCookies = filterBOSessionSetCookies(readSetCookies(res.headers));

    // Always invalidate cache on auth failures (401/403)
    if (!res.ok) {
      sessionCache.delete(cacheKey);
      return {
        status: res.status === 401 || res.status === 403 ? "unauthenticated" : "unavailable",
        session: null,
        movingExpirationDate: null,
        setCookies,
      };
    }

    const json = (await res.json()) as any;
    if (!json || json.success !== true || !json.session) {
      const movingExp = normalizeMovingExpirationDate(json?.moving_expiration_date);
      // Cache null sessions too to avoid hammering backend
      sessionCache.set(cacheKey, {
        session: null,
        movingExpirationDate: movingExp,
        setCookies,
        expiresAt: now + SESSION_CACHE_TTL_MS,
      });
      return { status: "unauthenticated", session: null, movingExpirationDate: movingExp, setCookies };
    }

    const session = json.session as BOSession;
    const movingExpirationDate = normalizeMovingExpirationDate(json?.moving_expiration_date);

    // Cache successful session
    sessionCache.set(cacheKey, {
      session,
      movingExpirationDate,
      setCookies,
      expiresAt: now + SESSION_CACHE_TTL_MS,
    });

    return { status: "authenticated", session, movingExpirationDate, setCookies };
  } catch (err) {
    if (isBackendConnectionError(err)) {
      logBackendUnavailable("fetchSession", backendOrigin, err);
    } else {
      console.error("[backoffice] fetchSession error", err);
    }
    return { status: "unavailable", session: null, movingExpirationDate: null, setCookies: [] };
    }
  })();

  sessionFetches.set(cacheKey, request);
  try {
    return await request;
  } finally {
    sessionFetches.delete(cacheKey);
  }
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function wantsHTML(req: express.Request): boolean {
  const accept = req.headers["accept"] ?? "";
  if (typeof accept !== "string") return true;
  if (accept.trim() === "") return true;
  return accept.includes("text/html") || accept.includes("*/*");
}

function isPageContextRequest(pathname: string, originalUrl?: string): boolean {
  if (/\.pageContext\.json\/?$/.test(pathname)) return true;
  if (typeof originalUrl === "string") {
    const pathOnly = originalUrl.split("?")[0] ?? "";
    if (/\.pageContext\.json\/?$/.test(pathOnly)) return true;
  }
  return false;
}

function sendHttpResponse(
  res: express.Response,
  httpResponse: { statusCode: number; headers?: Record<string, unknown>; body: unknown },
  opts?: { pageContextRequest?: boolean },
): void {
  const { body, statusCode, headers = {} } = httpResponse;
  const pageContextRequest = opts?.pageContextRequest === true;
  let hasContentTypeHeader = false;
  res.status(statusCode);

  if (typeof (headers as any)?.forEach === "function") {
    (headers as any).forEach((value: unknown, name: string) => {
      if (typeof name === "string" && name.toLowerCase() === "content-type") {
        hasContentTypeHeader = true;
      }
      if (typeof name === "string") {
        res.setHeader(name, value as any);
      }
    });
  } else {
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === "content-type") {
        hasContentTypeHeader = true;
      }
      res.setHeader(name, value as any);
    }
  }

  if (!hasContentTypeHeader) {
    res.type(pageContextRequest ? "application/json" : "text/html");
  }

  res.send(body as any);
}

function setServerTiming(res: express.Response, timings: { session: number; render: number; total: number }): void {
  res.setHeader(
    "Server-Timing",
    `session;dur=${timings.session.toFixed(1)}, render;dur=${timings.render.toFixed(1)}, total;dur=${timings.total.toFixed(1)}`,
  );
}

async function streamFetchBody(upstream: Response, res: express.Response): Promise<void> {
  if (!upstream.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(upstream.body as any), res);
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function defaultErrorMessage(statusCode: number): string {
  if (statusCode === 404) return "Pagina no encontrada";
  if (statusCode === 401) return "Sesion no autorizada";
  if (statusCode === 403) return "Acceso denegado";
  return "Error interno";
}

function renderFallbackErrorPage(statusCode: number, message?: string): string {
  const safeCode = Number.isFinite(statusCode) ? Math.trunc(statusCode) : 500;
  const safeMessage = escapeHTML((message ?? defaultErrorMessage(safeCode)).trim() || defaultErrorMessage(safeCode));
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeCode} · ${safeMessage}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(1200px 600px at 10% 0%, rgba(185, 168, 255, 0.16), transparent 60%),
        radial-gradient(1000px 500px at 100% 100%, rgba(147, 239, 231, 0.14), transparent 60%),
        #111218;
      color: #eef0f6;
    }
    .bo-fallback {
      width: min(520px, 100%);
      background: rgba(34, 35, 43, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 20px;
      padding: 28px 24px;
      text-align: center;
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.34);
    }
    .bo-fallback-code { font-size: clamp(48px, 14vw, 84px); line-height: 1; color: #b9a8ff; font-weight: 760; }
    .bo-fallback-title { margin: 12px 0 6px; font-size: 22px; font-weight: 680; }
    .bo-fallback-copy { margin: 0 0 20px; color: rgba(238, 240, 246, 0.72); }
    .bo-fallback-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .bo-fallback-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 40px;
      padding: 0 14px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #eef0f6;
      background: rgba(255, 255, 255, 0.04);
    }
    .bo-fallback-btn--primary {
      border-color: rgba(185, 168, 255, 0.45);
      background: rgba(185, 168, 255, 0.2);
    }
  </style>
</head>
<body>
  <main class="bo-fallback" role="main" aria-live="polite">
    <div class="bo-fallback-code">${safeCode}</div>
    <h1 class="bo-fallback-title">${safeMessage}</h1>
    <p class="bo-fallback-copy">No pudimos renderizar esta pantalla. Puedes volver al panel o recargar.</p>
    <div class="bo-fallback-actions">
      <a class="bo-fallback-btn bo-fallback-btn--primary" href="/app/backoffice">Volver al panel</a>
      <a class="bo-fallback-btn" href="">Reintentar</a>
    </div>
  </main>
</body>
</html>`;
}

function sendFallbackErrorPage(res: express.Response, statusCode: number, message?: string): void {
  if (res.headersSent) return;
  res.status(statusCode);
  res.type("text/html");
  res.send(renderFallbackErrorPage(statusCode, message));
}

function isUnrenderableVikeError(statusCode: number, body: unknown): boolean {
  if (statusCode < 500) return false;
  if (typeof body !== "string") return false;
  return body.includes("<p>An error occurred.</p>") && body.includes("error page");
}

function isValidISODate(v: string | null | undefined): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function wsOriginFromBackend(backendOrigin: string): string {
  const u = new URL(backendOrigin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  // Remove trailing slash to avoid double slashes when concatenating paths
  const origin = u.toString();
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function toBackendAdminPath(pathWithQuery: string): string {
  // Incoming from Express proxy at /api/admin/*: strip /api prefix for Go backend
  if (pathWithQuery === "/api/admin") return "/admin";
  if (pathWithQuery.startsWith("/api/admin/")) return pathWithQuery.replace("/api/admin/", "/admin/");
  // Legacy /admin/* paths → add /api prefix
  if (pathWithQuery === "/admin") return "/api/admin";
  if (pathWithQuery.startsWith("/admin/")) return `/api${pathWithQuery}`;
  return pathWithQuery;
}

function attachFichajeWSProxy(server: http.Server | https.Server, backendOrigin: string) {
  const wss = new WebSocketServer({ noServer: true });
  const wsBase = wsOriginFromBackend(backendOrigin);

  server.on("upgrade", (req, socket, head) => {
    const reqURL = req.url || "/";
    let pathname = "";
    try {
      pathname = new URL(reqURL, "http://local").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (!pathname.startsWith("/api/admin/fichaje/ws") && !pathname.startsWith("/api/admin/group-menus-v2/ws") && !pathname.startsWith("/api/admin/tables/ws") && !pathname.startsWith("/api/admin/vinos/ws") && !pathname.startsWith("/api/admin/comida/ws") && !pathname.startsWith("/api/admin/members/whatsapp/ws") && !pathname.startsWith("/api/admin/site-builder/ws") && !pathname.startsWith("/api/admin/assistant/ws")) return;

    if (pathname.startsWith("/api/admin/assistant/ws")) {
      // Keep diagnostic logging safe: upgrade headers include the session cookie.
      const { cookie: _cookie, authorization: _authorization, ...safeHeaders } = req.headers;
      console.error("[forky-debug] client upgrade:", reqURL, JSON.stringify(safeHeaders));
    }

    wss.handleUpgrade(req, socket, head, (clientWS) => {
      let upstreamPath = "";
      try {
        const reqURLParsed = new URL(reqURL, "http://local");
        upstreamPath = reqURLParsed.pathname;
        upstreamPath += reqURLParsed.search;
        upstreamPath = toBackendAdminPath(upstreamPath);
      } catch {
        clientWS.close();
        return;
      }

      const upstreamURL = wsBase + upstreamPath;

      const skip = new Set([
        "connection",
        "upgrade",
        "sec-websocket-key",
        "sec-websocket-version",
        "sec-websocket-extensions",
        "sec-websocket-protocol",
        "sec-websocket-accept",
        "host"
      ]);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (skip.has(k.toLowerCase())) continue;
        if (v === undefined) continue;
        if (Array.isArray(v)) headers[k] = v.join(", ");
        else if (typeof v === "string") headers[k] = v;
      }
      const sessionCookie = filterBOSessionCookie(headers.cookie);
      if (sessionCookie) headers.cookie = sessionCookie;
      else delete headers.cookie;
      headers.host = new URL(backendOrigin).host;
      headers["x-forwarded-host"] = req.headers.host || "";

      const upstreamWS = new WebSocket(upstreamURL, { headers });
      const hasSessionCookie = typeof headers.cookie === "string" && headers.cookie.includes("bo_session=");
      const isBunRuntime = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

      const closeBoth = () => {
        if (clientWS.readyState === WebSocket.OPEN || clientWS.readyState === WebSocket.CONNECTING) clientWS.close();
        if (upstreamWS.readyState === WebSocket.OPEN || upstreamWS.readyState === WebSocket.CONNECTING) upstreamWS.close();
      };

      if (!isBunRuntime) {
        upstreamWS.on("unexpected-response", (_request, response) => {
          const status = response.statusCode ?? 0;
          console.warn("[backoffice] ws proxy unexpected-response", { upstreamPath, status, hasSessionCookie });
          if (clientWS.readyState === WebSocket.OPEN || clientWS.readyState === WebSocket.CONNECTING) {
            if (status === 401 || status === 403) {
              clientWS.close(4401, "unauthorized");
            } else {
              clientWS.close(1011, "upstream-rejected");
            }
          }
          if (upstreamWS.readyState === WebSocket.OPEN || upstreamWS.readyState === WebSocket.CONNECTING) {
            upstreamWS.close();
          }
        });
      }

      clientWS.on("message", (data, isBinary) => {
        if (upstreamWS.readyState !== WebSocket.OPEN) return;
        upstreamWS.send(data, { binary: isBinary });
      });

      upstreamWS.on("message", (data, isBinary) => {
        if (clientWS.readyState !== WebSocket.OPEN) return;
        clientWS.send(data, { binary: isBinary });
      });

      clientWS.on("close", closeBoth);
      upstreamWS.on("close", closeBoth);

      clientWS.on("error", closeBoth);
      upstreamWS.on("error", (err) => {
        if (isBackendConnectionError(err)) {
          logBackendUnavailable("ws proxy", backendOrigin, err);
        } else {
          console.error("[backoffice] ws proxy upstream error", err);
        }
        closeBoth();
      });
    });
  });
}

async function start() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080";
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const previewOrigins = (process.env.PREVIEW_WEB_ORIGINS ?? process.env.PREVIEW_WEB_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!isProd && !(await isBackendReachable(backendOrigin))) {
    logBackendUnavailable("startup", backendOrigin);
  }

  const app = express();
  const staticRoots = [
    path.join(appRoot, "dist", "client"),
    path.join(appRoot, "public"),
  ];

  for (const root of staticRoots) {
    app.use("/media", express.static(path.join(root, "media"), { index: false, fallthrough: true }));
    app.use("/menu-preview", express.static(path.join(root, "menu-preview"), { index: false, fallthrough: true }));
  }

  // Browser fallback: avoid 404s when clients request "/favicon.ico".
  // We keep a single icon source and redirect to the SVG shipped in /public.
  app.get("/favicon.ico", (_req, res) => {
    res.redirect(302, "/favicon.svg");
  });

  // Proxy only the admin API to the Go backend.
  // Important: Vite serves modules under "/<path-from-root>", and we have "backoffice/api/*".
  // If we proxied "/api/*" we'd shadow Vite modules like "/api/client.ts".
  app.use("/api/admin", async (req, res) => {
    try {
      const upstreamURL = new URL(toBackendAdminPath(req.originalUrl), backendOrigin);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) headers.set(k, v.join(","));
        else headers.set(k, v);
      }

      // Let fetch set `Host` to upstream automatically.
      headers.delete("host");
      headers.set("x-forwarded-proto", requestScheme(req));
      const sessionCookie = filterBOSessionCookie(headers.get("cookie") ?? undefined);
      if (sessionCookie) headers.set("cookie", sessionCookie);
      else headers.delete("cookie");

      // A preference write changes session.preferences, which the SSR session
      // cache would otherwise keep serving stale for up to SESSION_CACHE_TTL_MS.
      // Drop both security-scope entries so the next render re-fetches fresh.
      if (req.method === "PUT" && req.path === "/me/preferences") {
        const prefToken = sessionTokenFromCookie(sessionCookie);
        if (prefToken) {
          const prefHash = sessionCacheKey(prefToken);
          sessionCache.delete(`${prefHash}:high`);
          sessionCache.delete(`${prefHash}:normal`);
        }
      }

      // Avoid upstream compression: the proxy buffers the body and can otherwise
      // end up forwarding mismatched `content-encoding`/`content-length` headers.
      headers.set("accept-encoding", "identity");

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
      // Ensure `Content-Length` matches our buffered body.
      if (body !== undefined) headers.delete("content-length");

      const init: RequestInit = {
        method: req.method,
        headers,
        body: body as any,
        redirect: "manual",
      };

      const upstream = await fetch(upstreamURL, {
        ...init,
        signal: upstreamSignal(req, res, proxyTimeoutForPath(req.path)),
      });
      res.status(upstream.status);

      for (const cookie of filterBOSessionSetCookies(readSetCookies(upstream.headers))) {
        res.append("set-cookie", cookie);
      }

      // Do not forward hop-by-hop headers. Also avoid forwarding content framing
      // headers because we buffer and re-send the body.
      const skip = new Set([
        "set-cookie",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "content-length",
        "content-encoding",
      ]);

      upstream.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (skip.has(lk)) return;
        res.setHeader(k, v);
      });

      await streamFetchBody(upstream, res);
    } catch (err) {
      if (isBackendConnectionError(err)) {
        logBackendUnavailable("proxy", backendOrigin, err);
        res.status(503).json({
          success: false,
          message: `Backend unavailable at ${backendOrigin}. Run: ${LOCAL_BACKEND_START_CMD}`,
        });
      } else {
        console.error("[backoffice] proxy error", err);
        const statusCode = (err as { statusCode?: number })?.statusCode === 413 ? 413 : isAbortError(err) ? 504 : 502;
        if (res.headersSent) {
          res.end();
          return;
        }
        res.status(statusCode).json({
          success: false,
          message: statusCode === 413 ? "Request body too large" : statusCode === 504 ? "Upstream timeout" : "Upstream error",
        });
      }
    }
  });

  // Proxy for public invoice lookup (no auth required)
  // This proxies to the backend which validates the token
  app.use("/api/public/invoices", async (req, res) => {
    try {
      const upstreamURL = new URL(req.originalUrl, backendOrigin);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) headers.set(k, v.join(","));
        else headers.set(k, v);
      }

      headers.delete("host");
      headers.delete("cookie");
      headers.set("accept-encoding", "identity");

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
      if (body !== undefined) headers.delete("content-length");

      const init: RequestInit = {
        method: req.method,
        headers,
        body: body as any,
        redirect: "manual",
      };

      const upstream = await fetch(upstreamURL, {
        ...init,
        signal: upstreamSignal(req, res, proxyTimeoutForPath(req.path)),
      });
      res.status(upstream.status);

      upstream.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk === "set-cookie") return; // Don't forward cookies for public API
        const skip = [
          "connection",
          "keep-alive",
          "proxy-authenticate",
          "proxy-authorization",
          "te",
          "trailer",
          "transfer-encoding",
          "upgrade",
          "content-length",
          "content-encoding",
        ];
        if (skip.includes(lk)) return;
        res.setHeader(k, v);
      });

      await streamFetchBody(upstream, res);
    } catch (err) {
      if (isBackendConnectionError(err)) {
        logBackendUnavailable("public invoice proxy", backendOrigin, err);
        res.status(503).json({
          success: false,
          message: `Backend unavailable at ${backendOrigin}. Run: ${LOCAL_BACKEND_START_CMD}`,
        });
      } else {
        console.error("[backoffice] public invoice proxy error", err);
        if (res.headersSent) return void res.end();
        const statusCode = (err as { statusCode?: number })?.statusCode === 413 ? 413 : isAbortError(err) ? 504 : 502;
        res.status(statusCode).json({
          success: false,
          message: statusCode === 413 ? "Request body too large" : statusCode === 504 ? "Upstream timeout" : "Upstream error",
        });
      }
    }
  });

  // Proxy for public legal-page lookup (no auth required). The public site
  // reads legal pages server-side; this same-origin proxy lets the backoffice
  // origin reach the endpoint too (e.g. e2e smoke, preview parity). GET-only.
  app.use("/api/public/legal-page", async (req, res) => {
    try {
      const upstreamURL = new URL(req.originalUrl, backendOrigin);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) headers.set(k, v.join(","));
        else headers.set(k, v);
      }
      headers.delete("host");
      headers.delete("cookie");
      headers.set("accept-encoding", "identity");

      const upstream = await fetch(upstreamURL, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: upstreamSignal(req, res, 30_000),
      });
      res.status(upstream.status);

      upstream.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk === "set-cookie") return;
        const skip = [
          "connection",
          "keep-alive",
          "proxy-authenticate",
          "proxy-authorization",
          "te",
          "trailer",
          "transfer-encoding",
          "upgrade",
          "content-length",
          "content-encoding",
        ];
        if (skip.includes(lk)) return;
        res.setHeader(k, v);
      });

      await streamFetchBody(upstream, res);
    } catch (err) {
      if (isBackendConnectionError(err)) {
        logBackendUnavailable("public legal-page proxy", backendOrigin, err);
        res.status(503).json({
          success: false,
          message: `Backend unavailable at ${backendOrigin}. Run: ${LOCAL_BACKEND_START_CMD}`,
        });
      } else {
        console.error("[backoffice] public legal-page proxy error", err);
        if (res.headersSent) return void res.end();
        res.status(isAbortError(err) ? 504 : 502).json({
          success: false,
          message: isAbortError(err) ? "Upstream timeout" : "Upstream error",
        });
      }
    }
  });

  // Proxy for local web preview iframe used by the menus wizard.
  // Keeping it same-origin avoids mixed-content issues when backoffice runs on HTTPS.
  app.use("/preview-web", async (req, res) => {
    try {
      const original = new URL(req.originalUrl, "https://local");
      const forced = original.searchParams.get("_bo_preview_origin");
      if (forced) original.searchParams.delete("_bo_preview_origin");
      const path = (original.pathname.replace(/^\/preview-web/, "") || "/") + (original.search || "");
      const candidates = (() => {
        if (!forced) return previewOrigins;
        const exact = previewOrigins.find((o) => o === forced);
        if (exact) return [exact];
        return previewOrigins;
      })();

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
      let lastErr: unknown = null;

      for (const origin of candidates) {
        try {
          const targetURL = new URL(path, origin);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (v === undefined) continue;
            if (Array.isArray(v)) headers.set(k, v.join(","));
            else headers.set(k, v);
          }
          headers.delete("host");
          headers.delete("cookie");
          headers.set("accept-encoding", "identity");
          if (body !== undefined) headers.delete("content-length");

          const upstream = await fetch(targetURL, {
            method: req.method,
            headers,
            body: body as any,
            redirect: "manual",
            signal: upstreamSignal(req, res, 30_000),
          });

          res.status(upstream.status);

          const skip = new Set([
            "set-cookie",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade",
            "content-length",
            "content-encoding",
          ]);
          upstream.headers.forEach((v, k) => {
            if (skip.has(k.toLowerCase())) return;
            res.setHeader(k, v);
          });

          await streamFetchBody(upstream, res);
          return;
        } catch (err) {
          lastErr = err;
        }
      }

      console.error("[backoffice] preview proxy error", lastErr);
      if (res.headersSent) return void res.end();
      res.status(isAbortError(lastErr) ? 504 : 502).send(isAbortError(lastErr) ? "Preview upstream timeout" : "Preview upstream unavailable");
    } catch (err) {
      console.error("[backoffice] preview proxy error", err);
      res.status(502).send("Preview upstream unavailable");
    }
  });

  // Optional JSON body parsing for non-proxied routes (we keep SSR handler GET-only).
  app.use(express.json({ limit: "256kb" }));

  // Dev: stale @fs path remap.
  // When the app runs in a Docker container the project root is /app, so Vite
  // generates module URLs like /@fs/app/node_modules/... . However, if a browser
  // has cached module URLs from a previous run where the root was the host path
  // (/var/www/...), it will request /@fs/var/www/newvillacarmen/backoffice/... .
  // Vite doesn't recognise that path (root is /app), so the request falls through
  // to the SSR catch-all, which returns an HTML error page with Content-Type:
  // text/html — causing browser MIME errors on .js modules. Rewrite any such
  // stale host-root @fs URLs to the container root before Vite handles them.
  app.use((req, _res, next) => {
    const staleFsPrefix = "/@fs/var/www/";
    if (req.url.startsWith(staleFsPrefix)) {
      // Map /@fs/var/www/.../newvillacarmen/backoffice/... -> /@fs/app/...
      // Preserve any query string (e.g. ?v=abc123) that follows the path.
      const [pathPart, queryPart] = req.url.split("?", 2);
      const markerIndex = pathPart.indexOf("/newvillacarmen/backoffice/");
      if (markerIndex !== -1) {
        const rest = pathPart.slice(markerIndex + "/newvillacarmen/backoffice/".length);
        req.url = `/@fs/app/${rest}${queryPart ? `?${queryPart}` : ""}`;
        req.originalUrl = req.url;
      }
    }
    next();
  });

  // Dev: attach Vite dev server middlewares for HMR.
  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
  let devServer: https.Server | null = null;
  if (!isProd) {
    const certPath = resolveAppPath(appRoot, process.env.TLS_CERT_PATH ?? "");
    const keyPath = resolveAppPath(appRoot, process.env.TLS_KEY_PATH ?? "");
    if (!certPath || !keyPath) {
      throw new Error("TLS_CERT_PATH and TLS_KEY_PATH are required in development for Secure cookies.");
    }
    const cert = readTLSFile(certPath);
    const key = readTLSFile(keyPath);

    // Create the HTTPS server up-front so Vite's HMR websocket can share it.
    // This keeps HMR on the same port/origin as the app (3010), so a reverse
    // proxy (nginx) only needs to proxy one port with WebSocket upgrade.
    devServer = https.createServer({ cert, key }, app);

    vite = await createViteServer({
      root: appRoot,
      server: {
        middlewareMode: true,
        https: { cert, key },
        // Share the app's HTTPS server for the HMR websocket. When served behind a
        // reverse proxy on a public HTTPS host, HMR_CLIENT_HOST/PORT tell the client
        // to connect back through the proxy (wss://<host>:443/) instead of the
        // internal port; nginx's `location /` upgrade forwards it to this server.
        hmr: {
          server: devServer,
          ...(process.env.HMR_CLIENT_HOST
            ? {
                protocol: process.env.HMR_CLIENT_PROTOCOL ?? "wss",
                host: process.env.HMR_CLIENT_HOST,
                clientPort: Number(process.env.HMR_CLIENT_PORT ?? 443),
              }
            : {}),
        },
      },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    // Prod: serve built client assets.
    const distClient = path.join(appRoot, "dist", "client");
    app.use(
      express.static(distClient, {
        index: false,
        setHeaders: (res, servedPath) => {
          if (/\/assets\/forky\/[^/]+\.(?:glb|gltf|bin|png|jpe?g|webp|avif)$/i.test(servedPath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
  }

  // SSR + guard middleware.
  // Express 5 uses path-to-regexp v6 where "*" is no longer a valid pattern.
  // Use a regex route to catch-all GET requests for SSR.
  app.get(/.*/, async (req, res, next) => {
    const requestStartedAt = performance.now();
    try {
      // Public routes that don't require authentication
      const isPublicRoute =
        req.path === "/" ||
        req.path === "/login" ||
        req.path === "/change-password" ||
        req.path === "/app" ||
        req.path.startsWith("/app/") ||
        req.path.startsWith("/factura/") ||
        req.path.startsWith("/invitacion/") ||
        req.path.startsWith("/onboarding/") ||
        req.path.startsWith("/reset-password/") ||
        req.path === "/confirm" ||
        req.path === "/cancel" ||
        req.path === "/update-rice" ||
        req.path === "/booking-policies";
      const isAppLike = isPublicRoute || req.path.startsWith("/factura/");
      if (!isAppLike && !wantsHTML(req)) return next();

      const cookies = parseCookies(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
      const theme = cookies.bo_theme === "light" ? "light" : "dark";
      const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
      const isMobile = isMobileUA(userAgent);
      const publicScheme = requestScheme(req);
      const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
      const backendCookieHeader = filterBOSessionCookie(cookieHeader) ?? "";
      const isPublicBookingPage =
        req.path === "/confirm" ||
        req.path === "/cancel" ||
        req.path === "/update-rice" ||
        req.path === "/booking-policies";
      const skipSessionLookup = req.path.startsWith("/factura/") || isPublicBookingPage;
      if (SSR_DEBUG) {
        console.log(`[SSR] ${req.path} cookieHeader=${backendCookieHeader ? "present" : "null"} mobile=${isMobile}`);
      }
      const sessionStartedAt = performance.now();
      const sessionFetch = skipSessionLookup
        ? { status: "unauthenticated" as const, session: null, movingExpirationDate: null, setCookies: [] }
        : await fetchSession(backendOrigin, backendCookieHeader, req.path, publicScheme);
      const sessionDuration = performance.now() - sessionStartedAt;
      const session = sessionFetch.session;
      const movingExpirationDate = sessionFetch.movingExpirationDate;
      if (sessionFetch.setCookies.length) {
        for (const cookie of sessionFetch.setCookies) {
          res.append("set-cookie", cookie);
        }
      }
      if (SSR_DEBUG) console.log(`[SSR] ${req.path} session=${session ? "valid" : "null"}`);

      const pageContextRequest = isPageContextRequest(req.path, req.originalUrl);
      if (sessionFetch.status === "unavailable") {
        res.setHeader("Server-Timing", `session;dur=${sessionDuration.toFixed(1)}`);
        if (pageContextRequest) {
          res.status(503).json({ statusCode: 503, message: "Backend unavailable" });
        } else {
          sendFallbackErrorPage(res, 503, "Backend unavailable");
        }
        return;
      }

      // Allow public access to invoice viewing route without session
      if (req.path.startsWith("/factura/")) {
        // Public route - render the page without requiring session
        const pageContextInit: any = {
          urlOriginal: req.originalUrl,
          headersOriginal: req.headers,
          bo: { theme, session: null, movingExpirationDate: null, isMobile } satisfies BOPageContext & { isMobile: boolean },
          boRequest: { cookieHeader: "", backendOrigin },
        };

        const renderStartedAt = performance.now();
        const pageContext = await renderPage(pageContextInit);
        const renderDuration = performance.now() - renderStartedAt;
        const httpResponse = pageContext.httpResponse;
        if (!httpResponse) return next();

        if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
          sendFallbackErrorPage(res, 500);
          return;
        }
        setServerTiming(res, { session: sessionDuration, render: renderDuration, total: performance.now() - requestStartedAt });
        sendHttpResponse(res, httpResponse, { pageContextRequest });
        return;
      }

      // Public booking pages (confirm, cancel, update-rice, booking-policies) — no session required
      if (isPublicBookingPage) {
        const pageContextInit: any = {
          urlOriginal: req.originalUrl,
          headersOriginal: req.headers,
          bo: { theme, session: null, movingExpirationDate: null, isMobile } satisfies BOPageContext & { isMobile: boolean },
          boRequest: { cookieHeader: "", backendOrigin },
        };

        const renderStartedAt = performance.now();
        const pageContext = await renderPage(pageContextInit);
        const renderDuration = performance.now() - renderStartedAt;
        const httpResponse = pageContext.httpResponse;
        if (!httpResponse) return next();

        if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
          sendFallbackErrorPage(res, 500);
          return;
        }
        setServerTiming(res, { session: sessionDuration, render: renderDuration, total: performance.now() - requestStartedAt });
        sendHttpResponse(res, httpResponse, { pageContextRequest });
        return;
      }

      const isAppRoot = req.path === "/app" || req.path === "/app/" || req.path === "/m" || req.path === "/m/";
      const isApp = isAppRoot || req.path.startsWith("/app/") || req.path.startsWith("/m/app/");
      if (isApp && !session && !pageContextRequest) {
        res.redirect(302, "/login");
        return;
      }
      if (req.path === "/change-password" && !session && !pageContextRequest) {
        res.redirect(302, "/login");
        return;
      }
      if (session?.user?.mustChangePassword && !pageContextRequest) {
        if (req.path !== "/change-password") {
          res.redirect(302, "/change-password");
          return;
        }
      }
      if (req.path === "/login" && session) {
        if (session.user.mustChangePassword) {
          res.redirect(302, "/change-password");
          return;
        }
        res.redirect(302, "/app/backoffice");
        return;
      }

      if (req.path === "/m/login" && session) {
        if (session.user.mustChangePassword) {
          res.redirect(302, "/change-password");
          return;
        }
        res.redirect(302, "/m/app/backoffice");
        return;
      }
      if (req.path === "/") {
        if (!session) {
          res.redirect(302, "/login");
          return;
        }
        if (session.user.mustChangePassword) {
          res.redirect(302, "/change-password");
          return;
        }
        res.redirect(302, "/app/backoffice");
        return;
      }
      if (req.path === "/change-password" && session && !session.user.mustChangePassword) {
        res.redirect(302, "/app/backoffice");
        return;
      }

      if (session && isAppRoot) {
        res.redirect(302, "/app/backoffice");
        return;
      }

      if (session && req.path.startsWith("/app/") && !pageContextRequest && !isPathAllowed(req.path, session.user.role, session.user.sectionAccess, session.user.roleImportance)) {
        res.redirect(302, firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance));
        return;
      }

      // Normalize reservas routes: always keep `?date=YYYY-MM-DD` present.
      // This avoids "no date selected" UI states on first load and keeps the URL stable.
      // Skip for Vike pageContext data requests — the redirect would break Vike's
      // client-side data fetching which expects JSON, not a 302 HTML redirect.
      const reservasPath = !pageContextRequest && (
        req.path.startsWith("/m/app/reservas")
          ? req.path.replace("/m/app/reservas", "/app/reservas")
          : req.path.startsWith("/app/reservas")
          ? req.path
          : null
      );
      if (reservasPath) {
        const url = new URL(req.originalUrl, "https://local");
        const cur = url.searchParams.get("date");
        if (!isValidISODate(cur)) {
          url.searchParams.set("date", todayISO());
          res.redirect(302, url.pathname + url.search);
          return;
        }
      }

      // RBAC check for /m/app/* paths: map to /app/* for permission checks
      const rbacPath = req.path.startsWith("/m/app/")
        ? req.path.replace("/m/app/", "/app/")
        : req.path;

      if (session && req.path.startsWith("/m/app/") && !pageContextRequest && !isPathAllowed(rbacPath, session.user.role, session.user.sectionAccess, session.user.roleImportance)) {
        res.redirect(302, firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance));
        return;
      }

      const pageContextInit: any = {
        urlOriginal: req.originalUrl,
        headersOriginal: req.headers,
        bo: { theme, session, movingExpirationDate, isMobile } satisfies BOPageContext & { isMobile: boolean },
        boRequest: { cookieHeader: backendCookieHeader, backendOrigin },
      };

      const renderStartedAt = performance.now();
      const pageContext = await renderPage(pageContextInit);
      const renderDuration = performance.now() - renderStartedAt;
      const httpResponse = pageContext.httpResponse;
      if (!httpResponse) return next();

      if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
        sendFallbackErrorPage(res, 500);
        return;
      }
      setServerTiming(res, { session: sessionDuration, render: renderDuration, total: performance.now() - requestStartedAt });
      sendHttpResponse(res, httpResponse, { pageContextRequest });
    } catch (err) {
      console.error(`[backoffice] SSR error ${req.method} ${req.originalUrl}:`, err);
      next(err);
      return;
    }
  });

  app.use((req, res, next) => {
    if (res.headersSent) {
      next();
      return;
    }
    if (!wantsHTML(req)) {
      next();
      return;
    }
    sendFallbackErrorPage(res, 404);
  });

  // Error handler middleware - render error page instead of default Express error
  app.use(async (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[backoffice] error handler ${req.method} ${req.originalUrl}:`, err);

    const rawStatusCode = Number((err as any)?.statusCode ?? (err as any)?.status);
    const isHttpError = Number.isFinite(rawStatusCode) && rawStatusCode >= 400 && rawStatusCode < 600;
    const statusCode = isHttpError ? Math.trunc(rawStatusCode) : 500;
    const pageContextRequest = isPageContextRequest(req.path, req.originalUrl);

    if (!isHttpError) {
      // For non-HTTP errors (like SSR exceptions), render the error page via vike
      try {
        const pageContextInit: any = {
          urlOriginal: req.originalUrl,
          headersOriginal: req.headers,
          bo: { theme: "dark", session: null, movingExpirationDate: null },
          boRequest: { cookieHeader: filterBOSessionCookie(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined) ?? "", backendOrigin },
          is404: false,
          is500: true,
          errorInfo: err,
        };

        const pageContext = await renderPage(pageContextInit);
        const httpResponse = pageContext.httpResponse;
        if (httpResponse) {
          if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
            sendFallbackErrorPage(res, 500);
            return;
          }
          sendHttpResponse(res, { ...httpResponse, statusCode: 500 }, { pageContextRequest });
          return;
        }
      } catch {
        // Fall back to simple error response
      }
    }

    const message = isHttpError
      ? String((err as any)?.message ?? "").trim()
      : isProd
        ? undefined
        : String((err as any)?.message ?? (err as any)?.stack ?? "").trim();
    if (pageContextRequest) {
      res.status(statusCode);
      res.type("application/json");
      res.send(JSON.stringify({ statusCode, message: message || defaultErrorMessage(statusCode) }));
      return;
    }
    sendFallbackErrorPage(res, statusCode, message);
  });

  if (isProd) {
    const server = app.listen(port, "0.0.0.0", () => {
      // eslint-disable-next-line no-console
      console.log(`[backoffice] listening on http://0.0.0.0:${port} (prod) backend=${backendOrigin}`);
    });
    attachFichajeWSProxy(server, backendOrigin);
    return;
  }

  const server = devServer ?? https.createServer(
    {
      cert: readTLSFile(resolveAppPath(appRoot, process.env.TLS_CERT_PATH ?? "")),
      key: readTLSFile(resolveAppPath(appRoot, process.env.TLS_KEY_PATH ?? "")),
    },
    app,
  );
  attachFichajeWSProxy(server, backendOrigin);

  server.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`[backoffice] listening on https://0.0.0.0:${port} (dev) backend=${backendOrigin}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
