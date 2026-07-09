/**
 * Inspect via window.getMatchedCSSRules or similar
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector('.bo-invoiceFiltersGrid', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // Use CSSStyleDeclaration APIs to inspect
    const result = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!el) return null;

      // Try iterating matched rules via @ts-ignore direct access
      // Find all CSS rules that mention bo-invoiceFiltersGrid
      const rules: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const collect = (rule: CSSRule, mediaCondition?: string) => {
            if (rule instanceof CSSMediaRule) {
              for (const inner of Array.from(rule.cssRules)) {
                collect(inner, rule.conditionText);
              }
            } else if (rule instanceof CSSStyleRule) {
              if (rule.selectorText.includes('bo-invoiceFiltersGrid') && rule.selectorText.match(/^[^{]*$/)) {
                const props: any[] = [];
                for (let i = 0; i < rule.style.length; i++) {
                  const name = rule.style[i];
                  props.push({ name, value: rule.style.getPropertyValue(name), priority: rule.style.getPropertyPriority(name) });
                }
                rules.push({
                  selector: rule.selectorText,
                  media: mediaCondition,
                  mediaActive: mediaCondition ? window.matchMedia(mediaCondition).matches : true,
                  props,
                });
              }
            }
          };
          for (const r of Array.from(sheet.cssRules)) collect(r);
        } catch {}
      }

      // Now check parent grid layout
      const parent = el.parentElement;
      let parentLayout: any = null;
      if (parent) {
        const pcs = window.getComputedStyle(parent);
        parentLayout = {
          className: parent.className,
          display: pcs.display,
          gridTemplateColumns: pcs.gridTemplateColumns,
          gridTemplateRows: pcs.gridTemplateRows,
        };
      }

      return {
        rules,
        parentLayout,
        elWidth: el.offsetWidth,
        elHeight: el.offsetHeight,
      };
    });

    console.log("El width/height:", result?.elWidth, "x", result?.elHeight);
    console.log("\nParent:", JSON.stringify(result?.parentLayout, null, 2));
    console.log("\nMatched rules for bo-invoiceFiltersGrid:");
    for (const r of result?.rules || []) {
      console.log(`\n  Selector: ${r.selector}`);
      console.log(`  Media: ${r.media || 'no'} (active: ${r.mediaActive})`);
      for (const p of r.props) {
        console.log(`    ${p.name}: ${p.value}${p.priority ? ' !important' : ''}`);
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });