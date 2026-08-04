import path from "node:path";

import { expect, test } from "../../fixtures/session";

test.describe("Stock OCR with local PaddleOCR", () => {
  test.skip(process.env.STOCK_OCR_E2E !== "1", "Set STOCK_OCR_E2E=1 for real OCR integration test");

  test("uploads document through backend and shows PaddleOCR provenance", async ({ adminPage }) => {
    test.setTimeout(300_000);
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("tab", { name: "OCR documentos" }).click();
    await expect(adminPage.getByTestId("stock-ocr-file")).toBeVisible();

    await adminPage.getByTestId("stock-ocr-file").setInputFiles(
      path.resolve(process.cwd(), "e2e/screenshots/facturas-localidad-scroll.png"),
    );
    const uploadResponse = adminPage.waitForResponse((response) => (
      response.url().endsWith("/api/admin/stock/documents/upload")
      && response.request().method() === "POST"
    ));
    await adminPage.getByTestId("stock-ocr-upload").click();

    const response = await uploadResponse;
    expect(response.status()).toBe(201);
    const payload = await response.json() as { success: boolean; model: string };
    expect(payload.success).toBe(true);
    expect(payload.model).toBe(process.env.PADDLEOCR_MODEL || "PaddleOCR-VL-1.6");
    await expect(adminPage.getByText(new RegExp(`Confianza ${payload.model}:`))).toBeVisible({ timeout: 30_000 });

    await adminPage.getByTestId("stock-ocr-reject").click();
    await expect(adminPage.getByTestId("stock-ocr-review-empty")).toBeVisible();
  });
});
