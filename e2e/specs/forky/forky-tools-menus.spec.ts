import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · menús", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("menus_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los menús de grupo.", ["menú", "menu", "menús", "precio"], "menus_list/1");
    await runReadCase(page, "Lista los menús incluyendo borradores.", ["menú", "borrador", "menu"], "menus_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Qué menús hay disponibles?", ["menú", "menu", "menús"], "menus_list/3");
  });

  test("menu_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Obtén el menú con id 1 con sus secciones.", ["menú", "sección", "menu", "plato"], "menu_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Dame los detalles del menú con id 2.", ["menú", "menu", "sección"], "menu_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Obtén el menú con id 999999.", ["menú", "no", "no existe", "id"], "menu_get/3", { allowEmptyMarkers: true });
  });

  test("menu_sections_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los platos de la sección 1 del menú 1.", ["plato", "sección", "menú", "dishes"], "menu_sections_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Platos de la sección 2 del menú 2.", ["plato", "sección", "menú"], "menu_sections_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Platos de la sección 999999 del menú 1.", ["sección", "no", "no encontrada"], "menu_sections_get/3", { allowEmptyMarkers: true });
  });

  test("menu_toggle_active (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Activa el menú con id 1.", ["menú", "activar", "confirmar", "confirmación"], "menu_toggle_active/1");
    await runWriteCase(page, "Desactiva el menú con id 2.", ["menú", "desactivar", "confirmar"], "menu_toggle_active/2");
    await runWriteCase(page, "Activa el menú con id 999999.", ["menú", "confirmar", "id", "no"], "menu_toggle_active/3");
  });
});
