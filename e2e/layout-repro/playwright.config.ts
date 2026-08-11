import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { headless: true },
});
