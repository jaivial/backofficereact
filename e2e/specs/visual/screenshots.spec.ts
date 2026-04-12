import { test, expect } from "../../fixtures/session";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, "../../screenshots");

const PAGES = [
  { name: "login", path: "/login", needsAuth: false },
  { name: "dashboard", path: "/app", needsAuth: true },
  { name: "reservas", path: "/app/reservas", needsAuth: true },
  { name: "reservas-create", path: "/app/reservas/anadir", needsAuth: true },
  { name: "reservas-config", path: "/app/reservas/config", needsAuth: true },
  { name: "reservas-tables", path: "/app/reservas/tables", needsAuth: true },
  { name: "comida", path: "/app/comida", needsAuth: true },
  { name: "comida-platos", path: "/app/comida/platos", needsAuth: true },
  { name: "comida-vinos", path: "/app/comida/vinos", needsAuth: true },
  { name: "comida-postres", path: "/app/comida/postres", needsAuth: true },
  { name: "menus", path: "/app/menus", needsAuth: true },
  { name: "miembros", path: "/app/miembros", needsAuth: true },
  { name: "miembros-roles", path: "/app/miembros/roles", needsAuth: true },
  { name: "fichaje", path: "/app/fichaje", needsAuth: true },
  { name: "horarios", path: "/app/horarios", needsAuth: true },
  { name: "config", path: "/app/config", needsAuth: true },
  { name: "settings", path: "/app/settings", needsAuth: true },
];

const BREAKPOINTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-428x926", width: 428, height: 926 },
  { name: "mobile-375x812", width: 375, height: 812 },
  { name: "mobile-320x568", width: 320, height: 568 },
];

test.describe("Visual - Responsive Screenshots", () => {
  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  for (const pageInfo of PAGES) {
    for (const bp of BREAKPOINTS) {
      test(`${pageInfo.name} at ${bp.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: bp.width, height: bp.height },
          ignoreHTTPSErrors: true,
        });

        const page = await context.newPage();

        // If page needs auth, login first
        if (pageInfo.needsAuth) {
          await page.goto("/login", { waitUntil: "networkidle" });
          await page.waitForSelector("form", { timeout: 15_000 });
          await page.fill('input[type="text"]', "admin@hotmail.com");
          await page.fill('input[type="password"]', "admin123123");
          await page.click('button[type="submit"]');
          await page.waitForURL("**/app/**", { timeout: 15_000 });
        }

        // Navigate to target page
        await page.goto(pageInfo.path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000); // Wait for animations/data

        // Take full page screenshot
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${pageInfo.name}-${bp.name}.png`
        );

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        // Verify screenshot was taken
        expect(fs.existsSync(screenshotPath)).toBe(true);
        const stats = fs.statSync(screenshotPath);
        expect(stats.size).toBeGreaterThan(1000); // At least 1KB

        await context.close();
      });
    }
  }
});
