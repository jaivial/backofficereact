import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · comida", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("catalog_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los platos de la carta.", ["plato", "comida", "precio", "carta", "euro"], "catalog_list/1");
    await runReadCase(page, "Lista los vinos de la carta.", ["vino", "precio", "carta", "euro"], "catalog_list/2");
    await runReadCase(page, "Busca en la carta algo llamado paella.", ["paella", "plato", "precio"], "catalog_list/3", { allowEmptyMarkers: true });
  });

  test("catalog_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Obtén el plato con id 1 de la carta.", ["plato", "precio", "id", "carta"], "catalog_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Dame el vino con id 1.", ["vino", "precio", "id"], "catalog_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Obtén el plato con id 999999.", ["plato", "no", "0", "no existe", "id"], "catalog_get/3", { allowEmptyMarkers: true });
  });

  test("catalog_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Crea un plato nuevo llamado Tarta de Queso.", ["tarta", "plato", "confirmar", "confirmación", "precio"], "catalog_create/1");
    await runWriteCase(page, "Crea un plato sin nombre.", ["plato", "obligator", "nombre", "confirmar"], "catalog_create/2");
    await runWriteCase(page, "Añade una bebida nueva a la carta.", ["bebida", "confirmar", "confirmación"], "catalog_create/3");
  });

  test("catalog_update (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Cambia el precio del plato con id 1.", ["plato", "precio", "confirmar", "confirmación"], "catalog_update/1");
    await runWriteCase(page, "Actualiza el plato con id 999999.", ["plato", "confirmar", "id", "actualizar"], "catalog_update/2");
    await runWriteCase(page, "Cambia la descripción de un vino.", ["vino", "confirmar", "descripción", "actualizar"], "catalog_update/3");
  });

  test("catalog_delete (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Desactiva el plato con id 1.", ["plato", "eliminar", "desactivar", "confirmar"], "catalog_delete/1");
    await runWriteCase(page, "Elimina el plato con id 999999.", ["plato", "eliminar", "confirmar", "id"], "catalog_delete/2");
    await runWriteCase(page, "Desactiva un vino de la carta.", ["vino", "eliminar", "desactivar", "confirmar"], "catalog_delete/3");
  });
});
