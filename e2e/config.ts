/**
 * Single source of truth for E2E environment resolution.
 *
 * The Playwright config (playwright.config.ts) loads .env files into
 * process.env at startup before global-setup and tests run, so this module
 * only reads — it never loads dotenv itself. Import this instead of
 * re-deriving baseURL / credentials in every helper.
 *
 * Resolution order mirrors the previous scattered fallbacks so existing
 * behaviour is preserved:
 *   - baseURL:   BACKOFFICE_URL > https://$URL > https://localhost:$PORT
 *   - admin:     E2E_ADMIN_* > BOOTSTRAP_ADMIN_* > LOGIN_* > hardcoded dev default
 */
export const e2eEnv = {
  baseURL:
    process.env.BACKOFFICE_URL ||
    (process.env.URL ? `https://${process.env.URL}` : `https://localhost:${process.env.PORT ?? "3010"}`),
  adminEmail:
    process.env.E2E_ADMIN_EMAIL ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    process.env.LOGIN_USER ||
    "admin@villacarmen.com",
  adminPassword:
    process.env.E2E_ADMIN_PASSWORD ||
    process.env.BOOTSTRAP_ADMIN_PASSWORD ||
    process.env.LOGIN_PASSWORD ||
    "admin123",
  isCI: !!process.env.CI,
  screenshotMode: process.env.SCREENSHOT_MODE || "only-on-failure",
} as const;

export type E2EEnv = typeof e2eEnv;
