/**
 * TDD test for reservas edit modal vertical scroll.
 *
 * Reproduces the modal DOM structure (same classes/hierarchy as
 * ui/overlays/Modal.tsx + pages/app/reservas/reservas.tsx edit modal +
 * pages/app/reservas/functionalComponents/BookingEditor/BookingEditor.tsx)
 * against the real project CSS rules, in a real browser via Playwright.
 *
 * Contract: when the editor content is taller than the modal viewport, the
 * user must be able to scroll the outer viewport so that the LAST content
 * panel and the footer primary action are fully visible (not clipped by the
 * modal's overflow:hidden).
 *
 * Run:
 *   npx playwright test --config=e2e/scroll-repro/playwright.config.ts
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = "file://" + path.join(__dirname, "modal-scroll.html");

test.describe("reservas edit modal scroll", () => {
  for (const vp of [
    { name: "desktop", w: 1280, h: 800 },
    { name: "mobile", w: 414, h: 760 },
  ]) {
    test(`last content and footer are reachable (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(HTML);

      const dialog = page.locator(".bo-reservasModal--edit");
      await expect(dialog).toBeVisible();

      const outerViewport = page.locator(
        '[data-slot="reservas-modalOutline-edit"] > .bo-scrollAreaViewport',
      );
      const lastContent = page.locator("#last-content");
      const primary = page.locator("#primary-action");

      // The outer viewport must actually overflow vertically (content taller than box).
      const scrollable = await outerViewport.evaluate((el) => ({
        sh: el.scrollHeight,
        ch: el.clientHeight,
      }));
      // outer viewport is not overflowing; nothing to scroll
      expect(scrollable.sh).toBeGreaterThan(scrollable.ch);

      // Scroll to the very bottom, like a user reaching the end of the form.
      await outerViewport.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });

      const modalBox = (await dialog.boundingBox())!;
      const lastBox = (await lastContent.boundingBox())!;
      const btnBox = (await primary.boundingBox())!;

      // Both the last content panel and the footer button must be fully within
      // the visible modal box (allow 1px rounding).
      // last content panel bottom is clipped below the modal viewport
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(modalBox.y + modalBox.height + 1);
      // footer primary action is clipped below the modal viewport
      expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(modalBox.y + modalBox.height + 1);
      // footer primary action is clipped above the modal viewport
      expect(btnBox.y).toBeGreaterThanOrEqual(modalBox.y - 1);
    });
  }
});
