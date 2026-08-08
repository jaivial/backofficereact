import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · plataforma", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("restaurant_settings_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Muéstrame la configuración del restaurante.", ["configuración", "restaurante", "nombre", "dirección"], "restaurant_settings_get/1");
    await runReadCase(page, "¿Cuál es la configuración básica del restaurante?", ["configuración", "restaurante", "nombre"], "restaurant_settings_get/2");
    await runReadCase(page, "Dame los datos del restaurante.", ["restaurante", "nombre", "teléfono", "dirección"], "restaurant_settings_get/3");
  });

  test("integrations_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "¿Qué integraciones hay configuradas?", ["integración", "configurada", "whatsapp", "stripe"], "integrations_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Estado de las integraciones del restaurante.", ["integración", "configurada", "whatsapp"], "integrations_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Lista las integraciones activas.", ["integración", "activa", "configurada"], "integrations_get/3", { allowEmptyMarkers: true });
  });

  test("branding_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Muéstrame el branding del restaurante.", ["branding", "logo", "marca", "color"], "branding_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuál es el logo del restaurante?", ["logo", "branding", "marca"], "branding_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Configuración de marca del restaurante.", ["branding", "marca", "logo", "color"], "branding_get/3", { allowEmptyMarkers: true });
  });

  test("whatsapp_bot_config_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Muéstrame la configuración del bot de WhatsApp.", ["whatsapp", "bot", "configuración", "idioma"], "whatsapp_bot_config_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cómo está configurado el bot de WhatsApp?", ["whatsapp", "bot", "configuración"], "whatsapp_bot_config_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Configuración del asistente de WhatsApp.", ["whatsapp", "bot", "configuración", "asistente"], "whatsapp_bot_config_get/3", { allowEmptyMarkers: true });
  });

  test("whatsapp_bot_config_update (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Actualiza la configuración del bot de WhatsApp.", ["whatsapp", "bot", "configuración", "confirmar", "confirmación"], "whatsapp_bot_config_update/1");
    await runWriteCase(page, "Cambia el idioma del bot a inglés.", ["whatsapp", "bot", "idioma", "confirmar"], "whatsapp_bot_config_update/2");
    await runWriteCase(page, "Desactiva los adjuntos del bot de WhatsApp.", ["whatsapp", "bot", "adjunto", "confirmar"], "whatsapp_bot_config_update/3");
  });
});
