import { expect, test } from "../../fixtures/session";
import { assertNoCriticalErrors, captureConsole } from "../../helpers/console";

test.describe("Stock page against the real backoffice", () => {
  test("loads /app/stock without console, page or API errors", async ({ adminPage }) => {
    const capture = captureConsole(adminPage);

    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });

    await expect(adminPage.getByRole("heading", { name: "Control de stock" })).toBeVisible();
    await expect(adminPage.getByTestId("stock-warehouse-filter")).toBeVisible();
    await expect(adminPage.getByTestId("stock-search")).toBeVisible();
    await expect(adminPage.locator("[data-ui='stock-summary-coverage']")).toContainText("cubierto");

    const report = assertNoCriticalErrors(capture);
    const stockApiErrors = report.networkErrors.filter((entry) => entry.url.includes("/api/admin/stock"));

    console.log("[stock-console] summary", JSON.stringify(report.summary));
    console.log("[stock-console] console errors", JSON.stringify(report.criticalErrors, null, 2));
    console.log("[stock-console] page errors", JSON.stringify(report.criticalPageErrors.map((error) => error.message), null, 2));
    console.log("[stock-console] network errors", JSON.stringify(report.networkErrors, null, 2));

    expect(report.criticalPageErrors.map((error) => error.message)).toEqual([]);
    expect(report.criticalErrors).toEqual([]);
    expect(stockApiErrors).toEqual([]);
  });

  test("navigates every stock section without runtime errors", async ({ adminPage }) => {
    const capture = captureConsole(adminPage);

    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });

    const sections: [string, string][] = [
      ["Recetas y previsión", "[data-ui='stock-operations']"],
      ["OCR documentos", "[data-ui='stock-ocr-panel']"],
      ["Configuración", "[data-ui='stock-settings-panel']"],
      ["Existencias", "[data-ui='stock-summary']"],
    ];

    for (const [label, panelSelector] of sections) {
      const tab = adminPage.getByRole("tab", { name: label });
      // Retry the click: the first attempt can land before React hydrates the SSR markup.
      await expect(async () => {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(adminPage.locator(panelSelector)).toBeVisible();
    }

    const report = assertNoCriticalErrors(capture);
    const stockApiErrors = report.networkErrors.filter((entry) => entry.url.includes("/api/admin/stock"));

    console.log("[stock-sections] summary", JSON.stringify(report.summary));
    console.log("[stock-sections] console errors", JSON.stringify(report.criticalErrors, null, 2));
    console.log("[stock-sections] page errors", JSON.stringify(report.criticalPageErrors.map((error) => error.message), null, 2));
    console.log("[stock-sections] network errors", JSON.stringify(report.networkErrors, null, 2));

    expect(report.criticalPageErrors.map((error) => error.message)).toEqual([]);
    expect(report.criticalErrors).toEqual([]);
    expect(stockApiErrors).toEqual([]);
  });
});
