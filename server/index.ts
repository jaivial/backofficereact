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
  name: string;
  role: string;
  roleImportance: number;
  sectionAccess: string[];
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
  const url = new URL("/api/admin/me", backendOrigin);
  const res = await fetch(url, {
    method: "GET",
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  if (!json || json.success !== true || !json.session) return null;
  return json.session as BOSession;
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
  return typeof accept === "string" ? accept.includes("text/html") : true;
}

function isValidISODate(v: string | null | undefined): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function wsOriginFromBackend(backendOrigin: string): string {
  const u = new URL(backendOrigin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
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
      let upstreamURL = "";
      try {
        upstreamURL = new URL(reqURL, wsBase).toString();
      } catch {
        clientWS.close();
        return;
      }

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

  // Proxy only the admin API to the Go backend.
  // Important: Vite serves modules under "/<path-from-root>", and we have "backoffice/api/*".
  // If we proxied "/api/*" we'd shadow Vite modules like "/api/client.ts".
  app.use("/api/admin", async (req, res) => {
    try {
      const upstreamURL = new URL(req.originalUrl, backendOrigin);

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
      const isAppLike = req.path === "/" || req.path === "/login" || req.path === "/app" || req.path.startsWith("/app/");
      if (!isAppLike && !wantsHTML(req)) return next();

      const cookies = parseCookies(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
      const theme = cookies.bo_theme === "light" ? "light" : "dark";
      const session = await fetchSession(backendOrigin, typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);

      const isApp = req.path === "/app" || req.path.startsWith("/app/");
      if (isApp && !session) {
        res.redirect(302, "/login");
        return;
      }
      if (req.path === "/login" && session) {
        res.redirect(302, firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance));
        return;
      }
      if (req.path === "/") {
        res.redirect(302, session ? firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance) : "/login");
        return;
      }

      if (session && req.path === "/app") {
        res.redirect(302, firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance));
        return;
      }

      if (session && req.path.startsWith("/app/") && !isPathAllowed(req.path, session.user.role, session.user.sectionAccess, session.user.roleImportance)) {
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

      const { body, statusCode, contentType, headers } = httpResponse;
      res.status(statusCode);
      res.type(contentType);
      for (const [k, v] of Object.entries(headers ?? {})) {
        res.setHeader(k, v as any);
      }
      res.send(body);
    } catch (err) {
      console.error("[backoffice] SSR error", err);
      next(err);
      return;
    }
  });

  if (isProd) {
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[backoffice] listening on http://127.0.0.1:${port} (prod) backend=${backendOrigin}`);
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

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[backoffice] listening on https://127.0.0.1:${port} (dev) backend=${backendOrigin}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
