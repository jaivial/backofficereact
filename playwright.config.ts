import { defineConfig, devices } from "@playwright/test";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url);

// https://playwright.dev/docs/test-configuration
export default defineConfig({
  // Run tests in files
  testDir: "./e2e",
  fullyParallel: true,
  // Retry failed tests on CI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 1 worker in CI to avoid conflicts
  workers: process.env.CI ? 1 : undefined,
  // Reporter
  reporter: [["html", { outputFolder: "test-results/report" }],
  // Default timeout
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Base URL for navigation
  use: {
    // Base URL for all tests
    baseURL: "https://localhost:3001",
    // Screenshots
    screenshot: "only-on-failure",
    // Video on first retry
    video: "on-first-retry",
    // Trace on first retry
    trace: "on-first-retry",
  },
  // Projects
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Dev server
  webServer: [
    {
      command: "npm run dev",
      url: "https://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "cd ../backend && go run ./cmd/server/main.go",
      url: "http://127.0.0.1:8080",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      // Wait for backend to be ready
      waitForSocket: "http://127.0.0.1:8080/healthz",
    },
  ],
});
