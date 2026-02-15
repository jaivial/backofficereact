import fs from "node:fs";
import https from "node:https";
import path from "node:path";

import express from "express";
import { createServer as createViteServer } from "vite";
import { renderPage } from "vike/server";

type BOUser = {
  id: number;
  email: string;
  name: string;
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

function wantsHTML(req: express.Request): boolean {
  const accept = req.headers["accept"] ?? "";
  return typeof accept === "string" ? accept.includes("text/html") : true;
}

async function start() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

  const app = express();

  // Proxy only the admin API to the Go backend.
  // Important: Vite serves modules under "/<path-from-root>", and we have "backoffice/api/*".
  // If we proxied "/api/*" we'd shadow Vite modules like "/api/client.ts".
  app.use("/api/admin", async (req, res) => {
    const upstreamURL = new URL(req.originalUrl, backendOrigin);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) headers.set(k, v.join(","));
      else headers.set(k, v);
    }
    // Let fetch set `Host` to upstream automatically.
    headers.delete("host");

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
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === "set-cookie") return;
      res.setHeader(k, v);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  });

  // Optional JSON body parsing for non-proxied routes (we keep SSR handler GET-only).
  app.use(express.json({ limit: "256kb" }));

  // Dev: attach Vite dev server middlewares for HMR.
  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
  if (!isProd) {
    const certPath = process.env.TLS_CERT_PATH ?? "";
    const keyPath = process.env.TLS_KEY_PATH ?? "";
    if (!certPath || !keyPath) {
      throw new Error("TLS_CERT_PATH and TLS_KEY_PATH are required in development for Secure cookies.");
    }
    const cert = readTLSFile(certPath);
    const key = readTLSFile(keyPath);

    vite = await createViteServer({
      root: process.cwd(),
      // In middleware mode Vite runs its HMR websocket server on a separate port.
      // When the page is served over HTTPS the client uses `wss://...`, so we need TLS here too.
      server: { middlewareMode: true, https: { cert, key } },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    // Prod: serve built client assets.
    const distClient = path.join(process.cwd(), "dist", "client");
    app.use(express.static(distClient, { index: false }));
  }

  // SSR + guard middleware.
  // Express 5 uses path-to-regexp v6 where "*" is no longer a valid pattern.
  // Use a regex route to catch-all GET requests for SSR.
  app.get(/.*/, async (req, res, next) => {
    if (!wantsHTML(req)) return next();

    const cookies = parseCookies(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
    const theme = cookies.bo_theme === "light" ? "light" : "dark";
    const session = await fetchSession(backendOrigin, typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);

    const isApp = req.path === "/app" || req.path.startsWith("/app/");
    if (isApp && !session) {
      res.redirect(302, "/login");
      return;
    }
    if (req.path === "/login" && session) {
      res.redirect(302, "/app/dashboard");
      return;
    }
    if (req.path === "/") {
      res.redirect(302, session ? "/app/dashboard" : "/login");
      return;
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
  });

  if (isProd) {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[backoffice] listening on http://127.0.0.1:${port} (prod)`);
    });
    return;
  }

  const server = https.createServer(
    {
      cert: readTLSFile(process.env.TLS_CERT_PATH ?? ""),
      key: readTLSFile(process.env.TLS_KEY_PATH ?? ""),
    },
    app,
  );

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[backoffice] listening on https://127.0.0.1:${port} (dev)`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
