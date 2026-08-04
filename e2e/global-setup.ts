/**
 * Global Playwright setup - runs once before all e2e tests.
 * Handles session caching across test runs.
 *
 * Loads credentials through Playwright config from local .env files.
 * Session is stored in a cache file so tests can reuse it.
 */
import { chromium, type FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

interface CachedSession {
  bo_session: string;
  expiresAt: number;
  email?: string;
}

const SESSION_CACHE_FILE = "test-results/.session-cache.json";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123";

async function loginViaAPI(
  browserPage: import("@playwright/test").Page,
  baseURL: string
): Promise<string> {
  // Warm up the browser context
  await browserPage.goto(baseURL, { waitUntil: "load", timeout: 30_000 });

  const loginResult = await browserPage.evaluate(
    async ({ url, email, password }: { url: string; email: string; password: string }) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
          credentials: "include",
        });
        const data = await res.json();
        return { success: data.success, message: data.message, status: res.status };
      } catch (e: unknown) {
        return { success: false, message: `fetch error: ${(e as Error).message}`, status: 0 };
      }
    },
    { url: `${baseURL}/api/admin/login`, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  );

  if (!loginResult.success) {
    throw new Error(`Login failed: ${loginResult.message}`);
  }

  // bo_session is HttpOnly — read it from the browser context, not document.cookie.
  // cookies() expects URLs (or no arg), not a bare hostname.
  const cookies = await browserPage.context().cookies(baseURL);
  const boSession = cookies.find((c) => c.name === "bo_session");
  if (!boSession) {
    throw new Error("No bo_session cookie found after login");
  }

  return boSession.value;
}

export default async function globalSetup(
  config: FullConfig
): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === "1") {
    console.log("[global-setup] Skipped via PLAYWRIGHT_SKIP_GLOBAL_SETUP=1");
    return;
  }

  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    (process.env.BACKOFFICE_URL ?? `https://localhost:${process.env.PORT ?? "3001"}`);

  const sessionCachePath = path.resolve(process.cwd(), SESSION_CACHE_FILE);

  // Try to load cached session from file
  let sessionCookie: string | null = null;
  if (fs.existsSync(sessionCachePath)) {
    try {
      const raw = fs.readFileSync(sessionCachePath, "utf-8");
      const parsed = JSON.parse(raw) as CachedSession;
      if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.email === ADMIN_EMAIL) {
        sessionCookie = parsed.bo_session;
        console.log("[global-setup] Reusing cached session");
      }
    } catch {
      // Cache corrupted — will re-login
    }
  }

  if (!sessionCookie) {
    // Create new session
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    sessionCookie = await loginViaAPI(page, baseURL);

    await context.close();
    await browser.close();

    // Persist to file cache
    const cacheDir = path.dirname(sessionCachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(
      sessionCachePath,
      JSON.stringify({ bo_session: sessionCookie, email: ADMIN_EMAIL, expiresAt: Date.now() + SESSION_TTL_MS })
    );
    console.log("[global-setup] New session cached");
  }

  // NOTE: global is NOT shared across Playwright worker processes.
  // Tests must read the session from SESSION_CACHE_FILE directly.
  console.log("[global-setup] Session seeded successfully");
}
