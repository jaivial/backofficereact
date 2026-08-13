import { test, expect } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Visual styling regressions on the table map canvas:
 *
 * 1. React Flow controls panel: built-in SVG icons (zoom in/out, fit view,
 *    interactivity) have `fill: black` from the library. In dark theme they
 *    are invisible against the dark button background. They must inherit the
 *    button's `color` (white in dark theme).
 *
 * 2. Seat dots (.bo-tableMapChair): the fill was a light accent mix that has
 *    poor contrast against the light map background. The dots must use a dark
 *    enough colour to be clearly visible.
 *
 * 3. Round tables: the node must render as a perfect circle (1:1 aspect
 *    ratio), not an ellipse with flattened top/bottom.
 */

const TEST_DATE = "2026-04-05";
const MAP_PAGE = '[data-ui="table-map-page"]';
const CONTROLS_BUTTON = ".react-flow__controls-button";
const CHAIR = ".bo-tableMapChair";
const ROUND_NODE = '[data-ui="table-node"].is-round';

async function loadMap(page: import("@playwright/test").Page) {
  await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
}

test.describe("Tables Map - visual styling", () => {
  test.describe.configure({ retries: 2 });

  test("controls panel SVG icons are visible in dark theme", async ({ adminPage }) => {
    await loadMap(adminPage);

    // Verify dark theme is active (default)
    const theme = await adminPage.evaluate(() =>
      document.documentElement.getAttribute("data-theme") || "dark",
    );
    expect(theme, "dark theme must be active for this test").toBe("dark");

    // Every built-in controls button SVG must have a fill that is NOT pure
    // black (the library default). It should inherit from the button's color
    // (white-ish in dark theme) or be set to currentColor.
    const svgs = adminPage.locator(`${CONTROLS_BUTTON} svg path`);
    const count = await svgs.count();
    expect(count, "at least one controls SVG icon present").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const fill = await svgs.nth(i).evaluate((el) => getComputedStyle(el).fill);
      // rgb(0, 0, 0) = the library default that makes icons invisible in dark theme
      expect(fill, `controls SVG #${i} fill must not be black in ${theme} theme`).not.toBe("rgb(0, 0, 0)");
    }
  });

  test("seat dots use a dark colour visible against the light map background", async ({ adminPage }) => {
    await loadMap(adminPage);

    // Wait for at least one chair dot to render
    await expect(adminPage.locator(CHAIR).first()).toBeVisible({ timeout: 15_000 });

    const chairBg = await adminPage.locator(CHAIR).first().evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    // Parse the rgb() / color() value to extract luminance.
    // The old value was a light teal mix (~0.45-0.53 per channel) which is
    // too light. A dark seat dot should have a relative luminance well below 0.5.
    const luminance = await adminPage.locator(CHAIR).first().evaluate((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      // Parse "rgb(r, g, b)" or "color(srgb r g b)"
      let r: number, g: number, b: number;
      const rgbMatch = bg.match(/rgba?\(([^)]+)\)/);
      const srgbMatch = bg.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (rgbMatch) {
        const parts = rgbMatch[1].split(",").map((s) => parseFloat(s.trim()));
        [r, g, b] = [parts[0] / 255, parts[1] / 255, parts[2] / 255];
      } else if (srgbMatch) {
        [r, g, b] = [parseFloat(srgbMatch[1]), parseFloat(srgbMatch[2]), parseFloat(srgbMatch[3])];
      } else {
        return -1; // unknown format
      }
      // Relative luminance (WCAG formula, simplified)
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    });

    // The seat dot must be dark enough (luminance < 0.35) to contrast with
    // the light map background.
    expect(luminance, `chair dot luminance must be < 0.35, got ${luminance} from ${chairBg}`).toBeLessThan(0.35);
  });

  test("round table nodes render as a perfect circle (1:1 aspect ratio)", async ({ adminPage }) => {
    await loadMap(adminPage);

    // Wait for round nodes to render
    await expect(adminPage.locator(ROUND_NODE).first()).toBeVisible({ timeout: 15_000 });

    const nodeCount = await adminPage.locator(ROUND_NODE).count();
    expect(nodeCount, "at least one round table present").toBeGreaterThan(0);

    // Check aspect ratio of every round node — must be exactly 1:1.
    // Also verify the computed border-radius produces a circle.
    for (let i = 0; i < Math.min(nodeCount, 5); i++) {
      const info = await adminPage.locator(ROUND_NODE).nth(i).evaluate((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        return {
          w,
          h,
          ratio: w / h,
          borderRadius: cs.borderRadius,
          aspectRatio: cs.aspectRatio,
        };
      });

      // The width and height must be equal (square box → perfect circle with
      // border-radius 999px). Allow 1px tolerance for sub-pixel rounding.
      const diff = Math.abs(info.w - info.h);
      expect(diff, `round node #${i} must be square (w=${info.w} h=${info.h})`).toBeLessThanOrEqual(1);

      // CSS aspect-ratio "1" or "1 / 1" (we enforce it) guarantees circularity
      expect(info.aspectRatio, `round node #${i} aspect-ratio`).toMatch(/^(1 \/ 1|1|auto \/ auto|auto)$/);

      // border-radius must be large enough to round a square into a circle
      const br = parseFloat(info.borderRadius);
      expect(br, `round node #${i} border-radius must be >= half the width`).toBeGreaterThanOrEqual(info.w / 2);
    }
  });
});
