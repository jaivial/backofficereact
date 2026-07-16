/**
 * Debug: find x-axis overflow inside the invoice "Añadir" form.
 *
 * Run: BACKOFFICE_URL=https://localhost:3006 bun run e2e/specs/facturas/debug-overflow.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3006";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

// Runs in the browser: collect x-overflow info for the invoice form.
function collectReport() {
  const form = document.querySelector<HTMLElement>(".bo-invoiceForm");
  if (!form) {
    return { formWidth: 0, selfOverflow: [], pastRightEdge: [], sections: [] } as const;
  }

  const formRect = form.getBoundingClientRect();
  const describe = (el: Element): string => {
    const e = el as HTMLElement;
    const cls = (e.className || "").toString().trim().split(/\s+/).slice(0, 3).join(".");
    const testid = e.getAttribute("data-testid");
    const slot = e.getAttribute("data-slot");
    return `${e.tagName.toLowerCase()}${cls ? "." + cls : ""}${testid ? `[testid=${testid}]` : ""}${slot ? `[slot=${slot}]` : ""}`;
  };

  const selfOverflow: Array<{ desc: string; clientWidth: number; scrollWidth: number }> = [];
  const pastRightEdge: Array<{ desc: string; right: number; formRight: number; width: number }> = [];

  for (const el of form.querySelectorAll<HTMLElement>("*")) {
    if (el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflowX !== "visible") {
      selfOverflow.push({ desc: describe(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth });
    }
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right - formRect.right > 1) {
      pastRightEdge.push({
        desc: describe(el),
        right: Math.round(r.right),
        formRight: Math.round(formRect.right),
        width: Math.round(r.width),
      });
    }
  }

  const sections = Array.from(form.querySelectorAll<HTMLElement>(".bo-invoiceFormTopGrid > .bo-invoiceFormSection")).map(
    (s) => {
      const r = s.getBoundingClientRect();
      const title = s.querySelector(".bo-invoiceFormSectionTitle")?.textContent?.trim() ?? "";
      return { title, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width) };
    },
  );

  return { formWidth: Math.round(formRect.width), selfOverflow, pastRightEdge, sections };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context: BrowserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });
    const page: Page = await context.newPage();

    console.log("Logging in...");
    await login(page);

    console.log("Opening /app/facturas?tab=añadir ...");
    await page.goto(`${BASE_URL}/app/facturas?tab=${encodeURIComponent("añadir")}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForSelector(".bo-invoiceForm", { timeout: 15_000 });
    await page.waitForTimeout(500);

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 375, height: 812 },
    ];

    let anyOverflow = false;
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      const r = await page.evaluate(collectReport);
      const stacked = r.sections.length === 2 ? r.sections[1].top >= r.sections[0].bottom - 2 : null;
      const overflow = r.selfOverflow.length + r.pastRightEdge.length;
      if (overflow > 0) anyOverflow = true;
      console.log(
        `\nviewport ${vp.width}x${vp.height}: formWidth=${r.formWidth} selfOverflow=${r.selfOverflow.length} pastRightEdge=${r.pastRightEdge.length} sectionsStacked=${stacked} sections=[${r.sections.map((s) => s.title).join(", ")}]`,
      );
      if (r.pastRightEdge.length) console.log(JSON.stringify(r.pastRightEdge.slice(0, 8), null, 2));
      if (r.selfOverflow.length) console.log(JSON.stringify(r.selfOverflow.slice(0, 8), null, 2));
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "e2e/screenshots/facturas-anadir-overflow.png", fullPage: true });
    console.log("\nScreenshot saved to e2e/screenshots/facturas-anadir-overflow.png");
    console.log(anyOverflow ? "\nRESULT: OVERFLOW DETECTED" : "\nRESULT: NO OVERFLOW");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
