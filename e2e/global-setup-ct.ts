/**
 * Global setup for Playwright Component Testing (CT).
 *
 * Runs once per test worker:
 * 1. Logs in via direct API call (faster, more reliable than UI)
 * 2. Extracts the bo_session cookie
 * 3. Stores it globally so CT tests can inject it before mounting components
 *
 * The cookie is stored in a shared cache file so multiple workers can reuse
 * the same session (avoids repeated login calls during parallel test runs).
 */
import { chromium, type FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ESM: derive __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CachedSession {
  bo_session: string;
  expiresAt: number;
}

const SESSION_CACHE_FILE = path.resolve(
  __dirname,
  "../test-results/.ct-session-cache.json"
);

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@hotmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123123";

async function loginViaAPI(baseURL: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Log any console messages from the page (useful for debugging)
  page.on("console", msg => {
    if (msg.type() === "error") {
      console.error(`[global-setup-ct][page] ${msg.text()}`);
    }
  });

  // Warm up the browser context by navigating to the base URL first.
  // This ensures:
  // 1. The webServer health check has passed (server is fully up)
  // 2. The browser has warmed up its SSL context for localhost
  console.log(`[global-setup-ct] Warming up browser context at ${baseURL}...`);
  await page.goto(baseURL, { waitUntil: "load", timeout: 30_000 });

  console.log(`[global-setup-ct] Calling /api/admin/login directly...`);

  // Call the login API directly via page.evaluate (bypasses UI, works with SSR)
  const loginResult = await page.evaluate(
    async ({ url, email, password }) => {
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
          credentials: "include",
        });
      } catch (e: unknown) {
        return { success: false, message: `fetch error: ${(e as Error).message}`, status: 0 };
      }

      let data;
      try {
        data = await res.json();
      } catch (e: unknown) {
        return { success: false, message: `json parse error: ${(e as Error).message}`, status: res.status };
      }

      return {
        success: data.success,
        message: data.message,
        status: res.status,
      };
    },
    {
      url: `${baseURL}/api/admin/login`,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }
  );

  console.log(`[global-setup-ct] API login result: ${JSON.stringify(loginResult)}`);

  if (!loginResult.success) {
    console.error(`[global-setup-ct] Login failed: ${loginResult.message}`);
    // Try UI fallback
    console.log(`[global-setup-ct] Falling back to UI login...`);
    await page.goto(`${baseURL}/login`, { waitUntil: "load" });

    // Wait for React to hydrate
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"]');
        return btn && !(btn as HTMLButtonElement).disabled;
      },
      { timeout: 20_000 }
    );

    // Fill and submit
    await page.fill('input[autocomplete="username"]', ADMIN_EMAIL);
    await page.fill('input[autocomplete="current-password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect
    try {
      await page.waitForURL("**/app**", { timeout: 15_000 });
    } catch {
      throw new Error(
        `[global-setup-ct] UI login fallback also failed. Check credentials.`
      );
    }
  } else {
    // API login succeeded. The bo_session cookie was set by the browser automatically.
    // fetch() doesn't expose Set-Cookie headers to JS, so we read it from the context.
    console.log("[global-setup-ct] API login succeeded, reading cookie from browser context...");
  }

  // Extract bo_session from cookies set on localhost
  // bo_session is HttpOnly, so document.cookie can't read it — use context.cookies() instead
  const cookies = await context.cookies("https://localhost");
  const boSession = cookies.find((c) => c.name === "bo_session");

  await context.close();
  await browser.close();

  if (!boSession) {
    throw new Error(
      `[global-setup-ct] Failed to get bo_session cookie. Login result: ${JSON.stringify(loginResult)}`
    );
  }

  console.log("[global-setup-ct] Session cookie obtained successfully");
  return boSession.value;
}

export default async (config: FullConfig) => {
  const baseURL = config.projects[0].use.baseURL!;
  console.log("[global-setup-ct] Starting CT session seeding...");

  let sessionCookie: string | null = null;

  // Try to reuse cached session (2-hour TTL)
  if (fs.existsSync(SESSION_CACHE_FILE)) {
    try {
      const cached: CachedSession = JSON.parse(
        fs.readFileSync(SESSION_CACHE_FILE, "utf-8")
      );
      if (cached.expiresAt && Date.now() < cached.expiresAt) {
        sessionCookie = cached.bo_session;
        console.log("[global-setup-ct] Reusing cached CT session");
      }
    } catch {
      // Cache invalid, proceed to create new session
    }
  }

  // Create new session if no valid cache
  if (!sessionCookie) {
    sessionCookie = await loginViaAPI(baseURL);
    fs.mkdirSync(path.dirname(SESSION_CACHE_FILE), { recursive: true });
    fs.writeFileSync(
      SESSION_CACHE_FILE,
      JSON.stringify({
        bo_session: sessionCookie,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      })
    );
    console.log("[global-setup-ct] New CT session cached");
  }

  // NOTE: global is NOT shared across Playwright worker processes.
  // Tests must read the session from SESSION_CACHE_FILE instead.
  console.log("[global-setup-ct] Session seeded successfully");
};
