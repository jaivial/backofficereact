import { test } from "@playwright/test";
import { gotoDashboard, openForkyModal, runReadCase, runWriteCase, loginAsAdmin } from "../../helpers/forkyTools";

const before = async ({ page }: { page: import("@playwright/test").Page }) => {
  test.setTimeout(420_000);
  await loginAsAdmin(page);
  await gotoDashboard(page);
  await openForkyModal(page);
};

test.describe("Forky tools · reservas", () => {
  test("restaurant_info (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "¿Cómo se llama el restaurante y cuál es su teléfono?", ["villa carmen", "restaurante", "teléfono", "phone"], "restaurant_info/1");
    await runReadCase(page, "Dame el nombre y la dirección del restaurante.", ["villa carmen", "dirección", "restaurante"], "restaurant_info/2");
    await runReadCase(page, "¿Qué teléfono tiene el restaurante?", ["teléfono", "phone", "llamar"], "restaurant_info/3");
  });

  test("bookings_summary (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "Dame un resumen de reservas de hoy (total y personas).", ["reserva", "persona", "total"], "bookings_summary/1");
    await runReadCase(page, "Resumen de reservas de este mes.", ["reserva", "persona", "mes"], "bookings_summary/2");
    await runReadCase(page, "¿Cuántas reservas hubo el 2025-01-01?", ["reserva", "0", "ninguna", "total"], "bookings_summary/3");
  });

  test("bookings_list (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "Lista las reservas de hoy en una tabla.", ["reserva", "cliente", "hora", "personas", "fecha"], "bookings_list/1");
    await runReadCase(page, "Tabla con las reservas de la semana que viene.", ["reserva", "cliente", "hora", "personas", "mesa"], "bookings_list/2");
    await runReadCase(page, "Muestra las reservas del 2024-06-15.", ["reserva", "ninguna", "0", "no hay"], "bookings_list/3", { allowEmptyMarkers: true });
  });

  test("restaurant_query (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "¿Cuántas reservas hay en total?", ["reserva"], "restaurant_query/1");
    await runReadCase(page, "¿Cuántos menús de grupo hay?", ["menú", "menu", "menús"], "restaurant_query/2");
    await runReadCase(page, "¿Cuántos vinos hay en la carta?", ["vino", "vinos"], "restaurant_query/3");
  });

  test("create_booking (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runWriteCase(page, "Crea una reserva para mañana a las 21:00 para 4 personas.", ["reserva", "confirmar", "confirmación", "personas"], "create_booking/1");
    await runWriteCase(page, "Crea una reserva sin nombre de cliente.", ["reserva", "obligator", "confirmar", "nombre"], "create_booking/2");
    await runWriteCase(page, "Crea una reserva de hoy a las 13:30 para 2.", ["reserva", "confirmar", "confirmación"], "create_booking/3");
  });

  test("update_booking (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runWriteCase(page, "Cambia la hora de la primera reserva de hoy a las 20:30.", ["reserva", "confirmar", "confirmación", "actualizar"], "update_booking/1");
    await runWriteCase(page, "Aumenta a 6 personas la reserva con id 99999.", ["reserva", "confirmar", "actualizar", "id"], "update_booking/2");
    await runWriteCase(page, "Actualiza la fecha de una reserva sin decir cuál.", ["reserva", "confirmar", "id", "actualizar"], "update_booking/3");
  });

  test("delete_booking (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runWriteCase(page, "Cancela la reserva con id 99999.", ["reserva", "cancelar", "confirmar", "id"], "delete_booking/1");
    await runWriteCase(page, "Anula una reserva sin especificar el id.", ["reserva", "cancelar", "confirmar", "id"], "delete_booking/2");
    await runWriteCase(page, "Cancela una reserva de hoy por nombre de cliente.", ["reserva", "cancelar", "confirmar"], "delete_booking/3");
  });

  test("customers_list (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "Lista los clientes conocidos.", ["cliente", "email", "teléfono", "fuente"], "customers_list/1");
    await runReadCase(page, "Busca clientes que contengan la letra a.", ["cliente", "email"], "customers_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Busca el cliente llamado zzxyznoexiste.", ["cliente", "ninguno", "no hay", "0"], "customers_list/3", { allowEmptyMarkers: true });
  });

  test("booking_limits_update (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runWriteCase(page, "Pon un límite diario de 100 reservas para la semana que viene.", ["límite", "reserva", "confirmar", "confirmación"], "booking_limits_update/1");
    await runWriteCase(page, "Establece un límite de -5 reservas para mañana.", ["límite", "reserva", "negativ", "inválid"], "booking_limits_update/2");
    await runWriteCase(page, "Actualiza el límite de reservas para una fecha.", ["límite", "reserva", "confirmar"], "booking_limits_update/3");
  });

  test("booking_limits_get (3 edge cases)", async ({ page }) => {
    await before({ page });
    await runReadCase(page, "¿Cuál es el límite de reservas de hoy y cuántas plazas quedan?", ["límite", "plaza", "reserva", "ocupación"], "booking_limits_get/1");
    await runReadCase(page, "¿Cuál es el límite diario para el 2026-12-25?", ["límite", "plaza", "reserva"], "booking_limits_get/2");
    await runReadCase(page, "Muéstrame el límite y las plazas libres de este domingo.", ["límite", "plaza", "reserva"], "booking_limits_get/3");
  });
});
