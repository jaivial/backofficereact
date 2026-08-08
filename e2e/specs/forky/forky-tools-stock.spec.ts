import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · stock", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("stock_warehouses_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los almacenes.", ["almacén", "almacenes", "stock", "principal"], "stock_warehouses_list/1");
    await runReadCase(page, "¿Qué almacenes tiene el restaurante?", ["almacén", "almacenes", "stock"], "stock_warehouses_list/2");
    await runReadCase(page, "Muéstrame los almacenes y su tipo.", ["almacén", "almacenes", "tipo"], "stock_warehouses_list/3");
  });

  test("stock_categories_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las categorías de stock.", ["categoría", "categorias", "stock"], "stock_categories_list/1");
    await runReadCase(page, "¿Qué categorías hay en el stock?", ["categoría", "categorias", "stock"], "stock_categories_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Categorías de productos del almacén.", ["categoría", "categorias", "stock"], "stock_categories_list/3", { allowEmptyMarkers: true });
  });

  test("stock_items_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los artículos de stock con sus cantidades.", ["stock", "artículo", "unidad", "gramo", "kg"], "stock_items_list/1");
    await runReadCase(page, "Busca en stock el artículo arroz.", ["arroz", "stock", "artículo"], "stock_items_list/2");
    await runReadCase(page, "Artículos de stock del tipo materia prima.", ["stock", "artículo", "materia", "unidad"], "stock_items_list/3", { allowEmptyMarkers: true });
  });

  test("stock_item_movements_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los movimientos de stock del artículo 1.", ["movimiento", "stock", "artículo", "entrada", "salida"], "stock_item_movements_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Movimientos del artículo con id 2.", ["movimiento", "stock", "artículo"], "stock_item_movements_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Movimientos del artículo con id 999999.", ["movimiento", "stock", "0", "ninguno"], "stock_item_movements_list/3", { allowEmptyMarkers: true });
  });

  test("stock_summary (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Resumen del stock actual.", ["stock", "artículo", "mínimo", "agotado", "existencias"], "stock_summary/1");
    await runReadCase(page, "¿Cuántos artículos hay por debajo del mínimo?", ["stock", "mínimo", "artículo", "bajo"], "stock_summary/2");
    await runReadCase(page, "Estado del stock: agotados y negativos.", ["stock", "agotado", "negativo", "artículo"], "stock_summary/3");
  });

  test("stock_movement_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra una entrada de 10 unidades de arroz.", ["stock", "movimiento", "confirmar", "confirmación", "artículo"], "stock_movement_create/1");
    await runWriteCase(page, "Registra una merma de stock.", ["stock", "merma", "confirmar", "movimiento"], "stock_movement_create/2");
    await runWriteCase(page, "Ajusta el stock de un artículo.", ["stock", "ajuste", "confirmar", "movimiento"], "stock_movement_create/3");
  });

  test("stock_transfer_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Transfiere stock de un almacén a otro.", ["stock", "transfer", "almacén", "confirmar", "confirmación"], "stock_transfer_create/1");
    await runWriteCase(page, "Mueve arroz del almacén principal a otro almacén.", ["stock", "transfer", "almacén", "confirmar"], "stock_transfer_create/2");
    await runWriteCase(page, "Transfiere stock al mismo almacén.", ["stock", "transfer", "almacén", "confirmar", "inválid"], "stock_transfer_create/3");
  });

  test("recipes_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las recetas.", ["receta", "recetas", "porción", "plato"], "recipes_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Qué recetas hay registradas?", ["receta", "recetas", "porción"], "recipes_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Recetas con su tiempo de preparación.", ["receta", "recetas", "minuto", "preparación"], "recipes_list/3", { allowEmptyMarkers: true });
  });

  test("production_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las órdenes de producción.", ["producción", "produccion", "orden", "receta"], "production_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Qué se ha producido recientemente?", ["producción", "produccion", "orden"], "production_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Estado de las producciones.", ["producción", "produccion", "estado"], "production_list/3", { allowEmptyMarkers: true });
  });

  test("waste_costs_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista las mermas registradas.", ["merma", "mermas", "coste", "coste"], "waste_costs_list/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuántas mermas de stock hay?", ["merma", "mermas", "stock"], "waste_costs_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Mermas y costes recientes.", ["merma", "mermas", "coste"], "waste_costs_list/3", { allowEmptyMarkers: true });
  });
});
