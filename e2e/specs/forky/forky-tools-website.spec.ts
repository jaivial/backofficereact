import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · web / site-builder", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("site_published_content_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Muéstrame el contenido publicado del sitio.", ["sitio", "publicado", "web", "contenido"], "site_published_content_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuál es el sitio web publicado del restaurante?", ["sitio", "publicado", "web"], "site_published_content_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Contenido publicado de la web.", ["sitio", "publicado", "web", "contenido"], "site_published_content_get/3", { allowEmptyMarkers: true });
  });

  test("site_publish (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Publica el sitio web del restaurante.", ["sitio", "publicar", "versión", "confirmar", "confirmación"], "site_publish/1");
    await runWriteCase(page, "Publica la versión actual de la web.", ["sitio", "publicar", "versión", "confirmar"], "site_publish/2");
    await runWriteCase(page, "Publica el sitio con id site-test.", ["sitio", "publicar", "confirmar", "id"], "site_publish/3");
  });
});
