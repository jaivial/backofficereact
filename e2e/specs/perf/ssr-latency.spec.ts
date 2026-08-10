/**
 * SSR latency baseline/regression measurement.
 *
 * For each target page, from a fresh authed context, records:
 *   - TTFB        (navigation timing)
 *   - shellPaint  (ms to render the app layout)
 *   - contentPaint(ms to render the page's primary content)
 *
 * Writes a JSON report to test-results/perf.json. No hard assertions —
 * this is the harness; thresholds land in the SSR nav test.
 *
 * Run: bunx playwright test e2e/specs/perf/ssr-latency.spec.ts --project=chromium
 */
import { test, expect, type Page } from "../../fixtures/session";
import * as fs from "fs";
import * as path from "path";

interface Target {
  name: string;
  url: string;
  contentSelector: string;
}

const TARGETS: Target[] = [
  { name: "reservas", url: "/app/reservas?date=2026-08-10", contentSelector: '[data-testid="reservas-section"]' },
  { name: "config", url: "/app/config", contentSelector: '[data-testid="config-section"]' },
  { name: "comida", url: "/app/comida", contentSelector: '[data-ui="food-hub-section"]' },
];

function getBaseURL() {
  return (
    process.env.BACKOFFICE_URL ||
    (process.env.URL ? `https://${process.env.URL}` : `https://localhost:${process.env.PORT || "3001"}`)
  );
}

async function measure(page: Page, target: Target): Promise<Record<string, number>> {
  const start = Date.now();
  await page.goto(target.url, { waitUntil: "commit", timeout: 30_000 });
  const shellStart = Date.now();
  await page.locator('[data-testid="app-layout-main"]').waitFor({ timeout: 20_000 });
  const shellPaint = Date.now() - start;
  await page.locator(target.contentSelector).waitFor({ timeout: 25_000 });
  const contentPaint = Date.now() - start;
  const ttfb = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType("navigation");
    return nav ? (nav as PerformanceNavigationTiming).responseStart - nav.startTime : -1;
  });
  return { ttfb, shellPaint, contentPaint };
}

test.describe("SSR latency baseline", () => {
  for (const target of TARGETS) {
    test(`measures ${target.name}`, async ({ adminPage }) => {
      const baseURL = getBaseURL();
      const r = await measure(adminPage, target);
      expect(r.ttfb).toBeGreaterThan(0);
      expect(r.contentPaint).toBeGreaterThan(0);

      const reportPath = path.join(process.cwd(), "test-results", "perf.json");
      const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : {};
      report[target.name] = {
        url: `${baseURL}${target.url}`,
        ...r,
        measuredAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      test.info().annotations.push({
        type: "perf",
        description: `${target.name}: TTFB=${r.ttfb}ms shell=${r.shellPaint}ms content=${r.contentPaint}ms`,
      });
    });
  }
});
