/**
 * Global Playwright setup — runs once before all e2e tests.
 *
 * Seeds a logged-in backoffice session and caches it on disk so repeated runs
 * skip the login round-trip. Credentials + baseURL come from e2e/config.ts
 * (env-driven). All login/cache logic lives in helpers/auth.ts.
 */
import { chromium, type FullConfig } from "@playwright/test";

import { e2eEnv } from "./config";
import { login, readCachedSession, writeCachedSession } from "./helpers/auth";

export default async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === "1") {
    console.log("[global-setup] Skipped via PLAYWRIGHT_SKIP_GLOBAL_SETUP=1");
    return;
  }

  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ?? e2eEnv.baseURL;

  // Reuse a still-valid cached session when it belongs to the same admin.
  const cached = readCachedSession(e2eEnv.adminEmail);
  if (cached) {
    console.log("[global-setup] Reusing cached session");
    return;
  }

  // Otherwise log in once, cache the cookie, close the throwaway browser.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const { boSession } = await login(page, {
      baseURL,
      email: e2eEnv.adminEmail,
      password: e2eEnv.adminPassword,
    });
    await context.close();
    writeCachedSession(boSession, e2eEnv.adminEmail);
    console.log("[global-setup] New session cached");
  } finally {
    await browser.close();
  }

  // NOTE: globals do not cross Playwright worker processes; workers read the
  // session from the cache file or log in themselves via the session fixture.
  console.log("[global-setup] Session seeded successfully");
}
