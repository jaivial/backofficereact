import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { createServer as createViteServer } from "vite";
import { renderPage } from "vike/server";
import { WebSocket, WebSocketServer } from "ws";
import { firstAllowedPath, isPathAllowed } from "../lib/rbac";

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
};

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
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

async function readRequestBody(req: express.Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const it = req as any as AsyncIterable<any>;
  for await (const chunk of it) {
    if (chunk === null || chunk === undefined) continue;
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function fetchSession(backendOrigin: string, cookieHeader: string | undefined): Promise<BOSession | null> {
  if (!cookieHeader) return null;
  try {
    // NOTE: backendOrigin already includes /api prefix, so use /admin/me.
    const url = new URL("/admin/me", backendOrigin);
    const res = await fetch(url, {
      method: "GET",
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (!json || json.success !== true || !json.session) return null;
    return json.session as BOSession;
  } catch (err) {
    console.error("[backoffice] fetchSession error", err);
    return null;
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

function sendHttpResponse(res: express.Response, httpResponse: { statusCode: number; headers?: Record<string, unknown>; body: unknown; contentType?: string | null }): void {
  const { body, statusCode, headers = {}, contentType } = httpResponse;
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
    if (typeof contentType === "string") {
      res.type(contentType);
    } else {
      res.type("text/html");
    }
  }

  res.send(body as any);
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
    if (!pathname.startsWith("/api/admin/fichaje/ws")) return;

    wss.handleUpgrade(req, socket, head, (clientWS) => {
      let upstreamPath = "";
      try {
        const reqURLParsed = new URL(reqURL, "http://local");
        // Strip /api prefix: /api/admin/... -> /admin/...
        upstreamPath = reqURLParsed.pathname.replace(/^\/api/, "");
        upstreamPath += reqURLParsed.search;
      } catch {
        clientWS.close();
        return;
      }

      const upstreamURL = wsBase + upstreamPath;

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) headers[k] = v.join(", ");
        else if (typeof v === "string") headers[k] = v;
      }
      headers.host = new URL(backendOrigin).host;

      const upstreamWS = new WebSocket(upstreamURL, { headers });

      const closeBoth = () => {
        if (clientWS.readyState === WebSocket.OPEN || clientWS.readyState === WebSocket.CONNECTING) clientWS.close();
        if (upstreamWS.readyState === WebSocket.OPEN || upstreamWS.readyState === WebSocket.CONNECTING) upstreamWS.close();
      };

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
        console.error("[backoffice] ws proxy upstream error", err);
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

  const app = express();

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
      // Strip /api prefix when forwarding to backend (backend uses /admin/* routes)
      const upstreamPath = req.originalUrl.replace(/^\/api(\/admin)/, "$1");
      const upstreamURL = new URL(upstreamPath, backendOrigin);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) headers.set(k, v.join(","));
        else headers.set(k, v);
      }

      // Let fetch set `Host` to upstream automatically.
      headers.delete("host");

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

      const upstream = await fetch(upstreamURL, init);
      res.status(upstream.status);

      const getSetCookie = (upstream.headers as any).getSetCookie as undefined | (() => string[]);
      if (getSetCookie) {
        for (const c of getSetCookie.call(upstream.headers)) {
          res.append("set-cookie", c);
        }
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

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      console.error("[backoffice] proxy error", err);
      res.status(502).json({ success: false, message: "Upstream error" });
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
      headers.set("accept-encoding", "identity");

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
      if (body !== undefined) headers.delete("content-length");

      const init: RequestInit = {
        method: req.method,
        headers,
        body: body as any,
        redirect: "manual",
      };

      const upstream = await fetch(upstreamURL, init);
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

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      console.error("[backoffice] public invoice proxy error", err);
      res.status(502).json({ success: false, message: "Upstream error" });
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
          headers.set("accept-encoding", "identity");
          if (body !== undefined) headers.delete("content-length");

          const upstream = await fetch(targetURL, {
            method: req.method,
            headers,
            body: body as any,
            redirect: "manual",
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

          const buf = Buffer.from(await upstream.arrayBuffer());
          res.send(buf);
          return;
        } catch (err) {
          lastErr = err;
        }
      }

      console.error("[backoffice] preview proxy error", lastErr);
      res.status(502).send("Preview upstream unavailable");
    } catch (err) {
      console.error("[backoffice] preview proxy error", err);
      res.status(502).send("Preview upstream unavailable");
    }
  });

  // Optional JSON body parsing for non-proxied routes (we keep SSR handler GET-only).
  app.use(express.json({ limit: "256kb" }));

  // Dev: attach Vite dev server middlewares for HMR.
  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
  if (!isProd) {
    const certPath = resolveAppPath(appRoot, process.env.TLS_CERT_PATH ?? "");
    const keyPath = resolveAppPath(appRoot, process.env.TLS_KEY_PATH ?? "");
    if (!certPath || !keyPath) {
      throw new Error("TLS_CERT_PATH and TLS_KEY_PATH are required in development for Secure cookies.");
    }
    const cert = readTLSFile(certPath);
    const key = readTLSFile(keyPath);

    vite = await createViteServer({
      root: appRoot,
      // In middleware mode Vite runs its HMR websocket server on a separate port.
      // When the page is served over HTTPS the client uses `wss://...`, so we need TLS here too.
      server: { middlewareMode: true, https: { cert, key } },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    // Prod: serve built client assets.
    const distClient = path.join(appRoot, "dist", "client");
    app.use(express.static(distClient, { index: false }));
  }

  // SSR + guard middleware.
  // Express 5 uses path-to-regexp v6 where "*" is no longer a valid pattern.
  // Use a regex route to catch-all GET requests for SSR.
  app.get(/.*/, async (req, res, next) => {
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
        req.path.startsWith("/reset-password/");
      const isAppLike = isPublicRoute || req.path.startsWith("/factura/");
      if (!isAppLike && !wantsHTML(req)) return next();

      const cookies = parseCookies(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
      const theme = cookies.bo_theme === "light" ? "light" : "dark";
      const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
      console.log(`[SSR] ${req.path} cookieHeader=${cookieHeader ? "present" : "null"}`);
      const session = await fetchSession(backendOrigin, cookieHeader);
      console.log(`[SSR] ${req.path} session=${session ? "valid" : "null"}`);

      const pageContextRequest = isPageContextRequest(req.path, req.originalUrl);

      // Allow public access to invoice viewing route without session
      if (req.path.startsWith("/factura/")) {
        // Public route - render the page without requiring session
        const pageContextInit: any = {
          urlOriginal: req.originalUrl,
          headersOriginal: req.headers,
          bo: { theme, session: null } satisfies BOPageContext,
          boRequest: { cookieHeader: req.headers.cookie ?? "", backendOrigin },
        };

        const pageContext = await renderPage(pageContextInit);
        const httpResponse = pageContext.httpResponse;
        if (!httpResponse) return next();

        if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
          sendFallbackErrorPage(res, 500);
          return;
        }
        sendHttpResponse(res, httpResponse);
        return;
      }

      const isAppRoot = req.path === "/app" || req.path === "/app/";
      const isApp = isAppRoot || req.path.startsWith("/app/");
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
      if (req.path.startsWith("/app/reservas")) {
        const url = new URL(req.originalUrl, "https://local");
        const cur = url.searchParams.get("date");
        if (!isValidISODate(cur)) {
          url.searchParams.set("date", todayISO());
          res.redirect(302, url.pathname + url.search);
          return;
        }
      }

      const pageContextInit: any = {
        urlOriginal: req.originalUrl,
        headersOriginal: req.headers,
        bo: { theme, session } satisfies BOPageContext,
        boRequest: { cookieHeader: req.headers.cookie ?? "", backendOrigin },
      };

      const pageContext = await renderPage(pageContextInit);
      const httpResponse = pageContext.httpResponse;
      if (!httpResponse) return next();

      if (isUnrenderableVikeError(httpResponse.statusCode, httpResponse.body) && !pageContextRequest) {
        sendFallbackErrorPage(res, 500);
        return;
      }
      sendHttpResponse(res, httpResponse);
    } catch (err) {
      console.error("[backoffice] SSR error", err);
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
    console.error("[backoffice] error handler:", err);

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
          bo: { theme: "dark", session: null },
          boRequest: { cookieHeader: req.headers.cookie ?? "", backendOrigin },
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
          sendHttpResponse(res, { ...httpResponse, statusCode: 500 });
          return;
        }
      } catch {
        // Fall back to simple error response
      }
    }

    const message = isHttpError ? String((err as any)?.message ?? "").trim() : undefined;
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

  const server = https.createServer(
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
