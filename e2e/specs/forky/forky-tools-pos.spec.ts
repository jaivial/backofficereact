import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase, forkyToolsEnabled } from "../../helpers/forkyTools";

test.describe("Forky tools · POS/TPV", () => {
  test.skip(!forkyToolsEnabled, "requires FORKY_REAL_TOOLS_E2E=1");
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("pos_visits_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las visitas del TPV.", ["visita", "tpv", "mesa", "comensal", "servicio"], "pos_visits_list/1");
    await runReadCase(page, "Visitas abiertas ahora mismo.", ["visita", "abierta", "tpv", "mesa"], "pos_visits_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Visitas de hoy en el TPV.", ["visita", "tpv", "hoy", "mesa"], "pos_visits_list/3");
  });

  test("pos_tickets_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los tickets abiertos del TPV.", ["ticket", "tpv", "abierto", "mesa", "total"], "pos_tickets_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Tickets pagados de hoy.", ["ticket", "pagado", "tpv", "total"], "pos_tickets_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Qué tickets hay en el TPV?", ["ticket", "tpv", "total"], "pos_tickets_list/3", { allowEmptyMarkers: true });
  });

  test("pos_cash_closures_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los cierres de caja.", ["cierre", "caja", "turno", "importe"], "pos_cash_closures_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Cierres de caja recientes.", ["cierre", "caja", "turno"], "pos_cash_closures_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuándo fue el último cierre de caja?", ["cierre", "caja", "turno", "último"], "pos_cash_closures_list/3", { allowEmptyMarkers: true });
  });

  test("pos_cash_summary (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Resumen de caja del turno.", ["caja", "turno", "efectivo", "ingreso", "resumen"], "pos_cash_summary/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuánto hay en caja ahora?", ["caja", "efectivo", "turno", "total"], "pos_cash_summary/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Estado de la caja del TPV.", ["caja", "tpv", "turno", "efectivo"], "pos_cash_summary/3", { allowEmptyMarkers: true });
  });

  test("pos_cash_closure_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Cierra el turno de caja del TPV.", ["caja", "cierre", "turno", "confirmar", "confirmación"], "pos_cash_closure_create/1");
    await runWriteCase(page, "Haz un cierre de caja.", ["caja", "cierre", "confirmar", "turno"], "pos_cash_closure_create/2");
    await runWriteCase(page, "Cierra la caja con conteo de efectivo.", ["caja", "cierre", "efectivo", "confirmar"], "pos_cash_closure_create/3");
  });

  test("pos_visit_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Abre una visita de mesa en el TPV.", ["visita", "abrir", "confirmar", "confirmación", "mesa"], "pos_visit_create/1");
    await runWriteCase(page, "Abre una visita a domicilio.", ["visita", "domicilio", "confirmar", "abrir"], "pos_visit_create/2");
    await runWriteCase(page, "Abre una visita sin comensales.", ["visita", "abrir", "confirmar", "inválid", "comensal"], "pos_visit_create/3");
  });

  test("pos_ticket_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Crea un ticket para una visita abierta.", ["ticket", "visita", "confirmar", "confirmación"], "pos_ticket_create/1");
    await runWriteCase(page, "Abre un ticket en el TPV.", ["ticket", "abrir", "confirmar", "tpv"], "pos_ticket_create/2");
    await runWriteCase(page, "Crea un ticket para la visita con id 999999.", ["ticket", "visita", "confirmar", "id", "no"], "pos_ticket_create/3");
  });

  test("pos_ticket_line_add (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Añade una paella a un ticket abierto.", ["ticket", "línea", "plato", "confirmar", "confirmación"], "pos_ticket_line_add/1");
    await runWriteCase(page, "Añade dos cervezas a un ticket.", ["ticket", "cerveza", "línea", "confirmar"], "pos_ticket_line_add/2");
    await runWriteCase(page, "Añade un producto a un ticket sin especificar cuál.", ["ticket", "línea", "confirmar", "producto"], "pos_ticket_line_add/3");
  });

  test("pos_payment_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra un pago con tarjeta de un ticket.", ["ticket", "pago", "tarjeta", "confirmar", "confirmación"], "pos_payment_create/1");
    await runWriteCase(page, "Cobra un ticket en efectivo.", ["ticket", "pago", "efectivo", "confirmar"], "pos_payment_create/2");
    await runWriteCase(page, "Registra un pago sin importe.", ["ticket", "pago", "confirmar", "importe", "inválid"], "pos_payment_create/3");
  });

  test("pos_refund_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Haz un reembolso de un ticket.", ["ticket", "reembolso", "devolución", "confirmar", "confirmación"], "pos_refund_create/1");
    await runWriteCase(page, "Devuelve el importe de un ticket.", ["ticket", "reembolso", "devolución", "confirmar"], "pos_refund_create/2");
    await runWriteCase(page, "Reembolsa un ticket sin motivo.", ["ticket", "reembolso", "motivo", "confirmar", "obligator"], "pos_refund_create/3");
  });
});
