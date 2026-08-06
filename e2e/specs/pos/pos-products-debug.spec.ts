import { expect, test } from "../../fixtures/session";

/**
 * Debug: why are there no products on /app/pos?
 * Logs the bootstrap response shape, DOM state, and console/network errors.
 */
test("debug: inspect POS bootstrap and product grid", async ({ adminPage: page }) => {
  const bootstrapResponses: any[] = [];
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  await page.route("**/api/admin/pos/bootstrap", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    bootstrapResponses.push(body);
    await route.fulfill({ response });
  });

  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Fetch the full catalog (including inactive) to distinguish "no products"
  // from "all products inactive".
  const fullCatalog = await page.evaluate(async () => {
    const response = await fetch("/api/admin/pos/products", { credentials: "include" });
    return { ok: response.ok, status: response.status, body: await response.json() };
  });
  console.log("=== FULL CATALOG (incl. inactive) ===");
  console.log(JSON.stringify(fullCatalog, null, 2));

  // Check what the "Importar Carta" feature would offer (legacy menu source).
  const importPreview = await page.evaluate(async () => {
    const response = await fetch("/api/admin/pos/products/import-preview", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    return { ok: response.ok, status: response.status, body: await response.json() };
  });
  const items = (importPreview.body as any)?.items ?? [];
  const byType: Record<string, number> = {};
  for (const item of items) byType[item.sourceType] = (byType[item.sourceType] ?? 0) + 1;
  console.log("=== IMPORT PREVIEW (legacy carta source) ===");
  console.log(JSON.stringify({ ok: importPreview.ok, status: importPreview.status, count: items.length, byType, sample: items.slice(0, 5) }, null, 2));

  // DOM state
  const state = await page.evaluate(() => {
    const q = (sel: string) => document.querySelector(sel);
    const qa = (sel: string) => Array.from(document.querySelectorAll(sel));
    return {
      errorBanner: q('[data-testid="pos-error"]')?.textContent?.trim() ?? null,
      message: q('[data-testid="pos-message"]')?.textContent?.trim() ?? null,
      categoryPanel: q('[data-testid="pos-categories"]')?.textContent?.trim() ?? null,
      productGridCount: qa('[data-testid^="pos-product-"]').length,
      productGridHtml: q('[data-testid="pos-product-grid"]')?.innerHTML?.slice(0, 500) ?? null,
      posPageSections: qa('[data-ui="pos-page"] [data-ui]').map((el) => el.getAttribute("data-ui")),
      bodyText: document.body.innerText.slice(0, 800),
    };
  });

  console.log("=== BOOTSTRAP RESPONSES ===");
  console.log(JSON.stringify(bootstrapResponses, null, 2));
  console.log("=== DOM STATE ===");
  console.log(JSON.stringify(state, null, 2));
  console.log("=== CONSOLE ERRORS ===");
  console.log(JSON.stringify(consoleErrors, null, 2));
  console.log("=== FAILED REQUESTS ===");
  console.log(JSON.stringify(failedRequests, null, 2));

  expect(bootstrapResponses.length).toBeGreaterThanOrEqual(1);
});
