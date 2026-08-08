import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase, forkyToolsEnabled } from "../../helpers/forkyTools";

test.describe("Forky tools · fichaje", () => {
  test.skip(!forkyToolsEnabled, "requires FORKY_REAL_TOOLS_E2E=1");
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("fichaje_state_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "¿Cuál es el estado actual de fichaje?", ["fichaje", "entrada", "miembro", "hoy", "activo"], "fichaje_state_get/1");
    await runReadCase(page, "¿Quién está fichado ahora mismo?", ["fichaje", "entrada", "miembro", "activo"], "fichaje_state_get/2");
    await runReadCase(page, "Muéstrame mi estado de fichaje.", ["fichaje", "entrada", "miembro", "hoy"], "fichaje_state_get/3");
  });

  test("fichaje_entries_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los fichajes de hoy.", ["fichaje", "entrada", "salida", "hora", "fecha"], "fichaje_entries_list/1");
    await runReadCase(page, "Fichajes del día de hoy de todos los miembros.", ["fichaje", "entrada", "salida", "miembro"], "fichaje_entries_list/2");
    await runReadCase(page, "Fichajes de ayer.", ["fichaje", "entrada", "salida", "hora", "fecha"], "fichaje_entries_list/3");
  });

  test("fichaje_admin_start (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra la entrada de un miembro del personal.", ["fichaje", "entrada", "confirmar", "confirmación", "miembro"], "fichaje_admin_start/1");
    await runWriteCase(page, "Ficha la entrada del miembro con id 1.", ["fichaje", "entrada", "confirmar", "miembro"], "fichaje_admin_start/2");
    await runWriteCase(page, "Da de alta la entrada de un miembro que no existe.", ["fichaje", "entrada", "confirmar", "miembro", "no"], "fichaje_admin_start/3");
  });

  test("fichaje_admin_stop (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra la salida de un miembro del personal.", ["fichaje", "salida", "confirmar", "confirmación", "miembro"], "fichaje_admin_stop/1");
    await runWriteCase(page, "Ficha la salida del miembro con id 1.", ["fichaje", "salida", "confirmar", "miembro"], "fichaje_admin_stop/2");
    await runWriteCase(page, "Registra la salida de un miembro sin fichaje activo.", ["fichaje", "salida", "confirmar"], "fichaje_admin_stop/3");
  });

  test("fichaje_start (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra mi entrada de fichaje.", ["fichaje", "entrada", "confirmar", "confirmación"], "fichaje_start/1");
    await runWriteCase(page, "Quiero fichar mi entrada ahora.", ["fichaje", "entrada", "confirmar"], "fichaje_start/2");
    await runWriteCase(page, "Ponme el fichaje de entrada de hoy.", ["fichaje", "entrada", "confirmar"], "fichaje_start/3");
  });

  test("fichaje_stop (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra mi salida de fichaje.", ["fichaje", "salida", "confirmar", "confirmación"], "fichaje_stop/1");
    await runWriteCase(page, "Quiero fichar mi salida.", ["fichaje", "salida", "confirmar"], "fichaje_stop/2");
    await runWriteCase(page, "Cierra mi fichaje de hoy.", ["fichaje", "salida", "confirmar"], "fichaje_stop/3");
  });
});
