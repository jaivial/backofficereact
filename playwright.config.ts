import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function loadDotEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
    process.env[match[1]] = value;
  }
}

loadDotEnv(path.join(__dirname, "../backend/.env"));
loadDotEnv(path.join(__dirname, "../.env")); // # E2E playwright real app (URL, LOGIN_USER, LOGIN_PASSWORD)
loadDotEnv(path.join(__dirname, ".env"));
loadDotEnv(path.join(__dirname, ".env.local"));

const isCI = !!process.env.CI;
const isHeaded = process.env.HEADED === "1" || process.env.HEADED === "true";
const screenshotMode = process.env.SCREENSHOT_MODE || "only-on-failure";

// https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "test-results/playwright-report" }],
    ["list"],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/artifacts",

  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL:
      process.env.BACKOFFICE_URL ||
      (process.env.URL ? `https://${process.env.URL}` : `https://localhost:${process.env.PORT || "3001"}`),
    ignoreHTTPSErrors: true,
    screenshot: screenshotMode as "on" | "only-on-failure" | "off",
    video: "on-first-retry",
    trace: "on-first-retry",
    headless: !isHeaded,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "chromium-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "chromium-1024",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "tablet-portrait",
      use: {
        ...devices["iPad Pro 11"],
      },
    },
    {
      name: "mobile-large",
      use: {
        ...devices["iPhone 14 Pro Max"],
      },
    },
    {
      name: "mobile-standard",
      use: {
        ...devices["iPhone 12"],
      },
    },
    {
      name: "mobile-small",
      use: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1",
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: isCI
    ? [
        {
          command: "bun --env-file .env.local server/index.ts",
          url: "https://localhost:3001",
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
          ignoreHTTPSErrors: true,
        },
        {
          command: "cd ../backend && go run ./cmd/server/main.go",
          url: "http://127.0.0.1:8080",
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      ]
    : undefined,
});
