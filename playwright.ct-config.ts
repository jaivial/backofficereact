/**
 * Playwright Component Testing (CT) configuration.
 *
 * Runs actual TSX components in a headed Chromium browser with:
 * - Dev server auto-startup
 * - Session cookie seeding (admin auth)
 * - Full CSS/layout rendering (no jsdom)
 *
 * Tests use `mount()` from @playwright/test to render React components.
 * Run: npx playwright test -c playwright.ct-config.ts
 *
 * NOTE: Unlike vitest, Playwright CT does NOT support `vi.mock()`.
 * Use it for:
 *   - Pure presentational components (FoodItemCard, FoodList, etc.)
 *   - Components without Jotai/vike context dependencies
 *
 * For Storybook stories: use e2e/specs/storybook-hybrid.spec.ts instead.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.ct.tsx",

  // Run headed so we see the browser (useful for dev/debugging CT tests)
  // Set HEADED=false to run headless
  use: {
    baseURL: "https://localhost:3001",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    headless: false,
  },

  // Reporter: list for terminal, screenshot diffs go to test-results/ct-diffs
  reporter: [
    ["list"],
  ],

  outputDir: "test-results/ct-artifacts",

  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Auto-start the dev server for CT tests
  webServer: {
    command: "bun --env-file .env.local server/index.ts",
    url: "https://localhost:3001",
    reuseExistingServer: false, // Always start fresh for CT
    timeout: 60_000,
    ignoreHTTPSErrors: true,
  },

  // Global setup: seed admin session cookie once per worker
  globalSetup: "./e2e/global-setup-ct.ts",

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // Fully parallel for speed
  fullyParallel: true,

  // Forbid test.only in CI
  forbidOnly: !!process.env.CI,

  // No retries for CT (faster feedback)
  retries: 0,
});
