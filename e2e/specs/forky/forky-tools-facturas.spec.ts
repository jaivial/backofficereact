import { test } from "@playwright/test";
import { openChat, runReadCase } from "../../helpers/forkyTools";

test.describe("Forky tools · facturas", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("invoices_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las facturas.", ["factura", "facturas", "importe", "estado", "iva"], "invoices_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Facturas emitidas este mes.", ["factura", "facturas", "importe", "mes"], "invoices_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Facturas pendientes de cobro.", ["factura", "facturas", "pendiente", "importe"], "invoices_list/3", { allowEmptyMarkers: true });
  });

  test("invoice_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Obtén la factura con id 1.", ["factura", "importe", "concepto", "iva"], "invoice_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Detalles de la factura con id 2.", ["factura", "importe", "concepto"], "invoice_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Obtén la factura con id 999999.", ["factura", "no", "no encontrada", "id"], "invoice_get/3", { allowEmptyMarkers: true });
  });
});
