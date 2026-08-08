import { test } from "@playwright/test";
import { openChat, runReadCase, forkyToolsEnabled } from "../../helpers/forkyTools";

test.describe("Forky tools · estadísticas", () => {
  test.skip(!forkyToolsEnabled, "requires FORKY_REAL_TOOLS_E2E=1");
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("analytics_report (6 edge cases: 4 metrics + 2 series)", async ({ page }) => {
    await runReadCase(page, "Genera un informe analítico de reservas de este mes con gráfico.", ["reserva", "gráfico", "serie", "chart", "día"], "analytics_report/bookings");
    await runReadCase(page, "Informe de ingresos (revenue) del último mes.", ["ingreso", "ingresos", "revenue", "€", "euro"], "analytics_report/revenue");
    await runReadCase(page, "Top productos más vendidos con gráfico.", ["producto", "venta", "top", "gráfico"], "analytics_report/products");
    await runReadCase(page, "Informe de stock actual.", ["stock", "artículo", "items"], "analytics_report/stock");
    await runReadCase(page, "Reservas por hora de hoy.", ["reserva", "hora", "gráfico", "serie"], "analytics_report/bookings_by_hour");
    await runReadCase(page, "Ingresos por día de la última semana.", ["ingreso", "día", "serie", "gráfico"], "analytics_report/revenue_by_day");
  });
});
