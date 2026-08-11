/**
 * TDD tests for reservas edit modal layout fixes.
 *
 * Covers three requirements on the edit-reserva modal:
 *  1. Footer spans the full modal width with no horizontal margin/padding
 *     (footer only; the rest of the modal keeps its padding).
 *  2. On mobile widths, the "Fecha" label and the date picker render as a
 *     column (label above input), the date picker fits its content and is
 *     centered. Same for "Hora".
 *  3. The calendar day cells keep a 1:1 aspect ratio (square) regardless of
 *     the selector button width, as long as they fit on screen.
 *
 * Run:
 *   npx playwright test --config=e2e/layout-repro/playwright.config.ts
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = "file://" + path.join(__dirname, "modal-layout.html");

const approxEq = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;

test.describe("reservas edit modal layout", () => {
  test("footer spans full modal width with no side margins/padding", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(HTML);

    const modal = page.locator("#edit-modal");
    const footer = page.locator("#editor-footer");
    const modalBox = (await modal.boundingBox())!;
    const footerBox = (await footer.boundingBox())!;

    // Footer left/right edges align with the modal edges (full width).
    expect(approxEq(footerBox.x, modalBox.x, 1)).toBe(true);
    expect(approxEq(footerBox.x + footerBox.width, modalBox.x + modalBox.width, 1)).toBe(true);
    // Footer has no horizontal padding (its content starts at the modal edge too).
    const pad = await footer.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight) };
    });
    expect(pad.pl).toBe(0);
    expect(pad.pr).toBe(0);
  });

  test("fecha label and date picker are a column on mobile, picker is centered and fit-content", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 800 });
    await page.goto(HTML);

    const field = page.locator("#date-field");
    const label = page.locator("#date-label");
    const btn = page.locator("#date-btn");

    const fieldBox = (await field.boundingBox())!;
    const labelBox = (await label.boundingBox())!;
    const btnBox = (await btn.boundingBox())!;

    // Column layout: label and button are stacked vertically (label fully above button).
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(btnBox.y + 1);

    // The field is a column (flex-direction column) and centered horizontally.
    const dir = await field.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe("column");

    // The button is horizontally centered within the field.
    const fieldCenter = fieldBox.x + fieldBox.width / 2;
    const btnCenter = btnBox.x + btnBox.width / 2;
    expect(Math.abs(fieldCenter - btnCenter)).toBeLessThan(2);

    // The button width fits its content (not stretched to the full row width).
    const rowBox = (await page.locator("#schedule-row").boundingBox())!;
    expect(btnBox.width).toBeLessThan(rowBox.width - 4);
  });

  test("hora label and time selector are a column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 800 });
    await page.goto(HTML);

    const field = page.locator("#time-field");
    const label = page.locator("#time-label");
    const btn = page.locator("#time-btn");
    const labelBox = (await label.boundingBox())!;
    const btnBox = (await btn.boundingBox())!;

    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(btnBox.y + 1);
    const dir = await field.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe("column");
  });

  test("calendar day cells are square (1:1) and scale with popover width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(HTML);

    // Inject a date picker popover at increasing widths; assert cells stay square
    // and grow with the width (scale, not a fixed px size).
    const widths = [240, 280, 340, 400] as const;
    const cellWidths: number[] = [];
    for (const w of widths) {
      const { ratio, cellW } = await page.evaluate((width) => {
        const portal = document.getElementById("bo-portal")!;
        portal.innerHTML = `
          <div class="bo-datePop" style="position:relative;width:${width}px;left:0;top:0">
            <div class="bo-calGrid" id="calgrid">
              ${Array.from({ length: 7 }, (_, i) => `<button class="bo-calDay" type="button">${i + 1}</button>`).join("")}
            </div>
          </div>`;
        const cell = portal.querySelector(".bo-calDay") as HTMLElement;
        const cr = cell.getBoundingClientRect();
        return { ratio: cr.width / cr.height, cellW: cr.width };
      }, w);
      // 1:1 aspect ratio within tolerance.
      expect(Math.abs(ratio - 1)).toBeLessThan(0.06);
      cellWidths.push(cellW);
    }
    // Cells grow as the popover widens (they scale, not fixed-size).
    for (let i = 1; i < cellWidths.length; i++) {
      expect(cellWidths[i]).toBeGreaterThan(cellWidths[i - 1]);
    }
  });
});
