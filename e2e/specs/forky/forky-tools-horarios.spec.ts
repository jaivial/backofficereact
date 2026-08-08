import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase, forkyToolsEnabled } from "../../helpers/forkyTools";

test.describe("Forky tools · horarios", () => {
  test.skip(!forkyToolsEnabled, "requires FORKY_REAL_TOOLS_E2E=1");
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("schedules_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los horarios laborales.", ["horario", "hora", "turno", "fecha", "miembro"], "schedules_list/1");
    await runReadCase(page, "Lista los horarios de hoy.", ["horario", "hora", "fecha"], "schedules_list/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Horarios de la semana que viene.", ["horario", "hora", "fecha", "semana"], "schedules_list/3", { allowEmptyMarkers: true });
  });

  test("schedules_by_date (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "¿Quién trabaja hoy?", ["horario", "turno", "trabaj", "currand", "personal", "hora", "equipo"], "schedules_by_date/1");
    await runReadCase(page, "Horarios del personal para mañana.", ["horario", "turno", "personal", "mañana", "hora"], "schedules_by_date/2", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Quién trabaja el 2025-12-25?", ["horario", "turno", "nadie", "no hay", "ninguno", "hora"], "schedules_by_date/3", { allowEmptyMarkers: true });
  });

  test("schedules_month (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Resumen de cobertura de horarios de este mes.", ["horario", "mes", "cobertura", "día", "personal"], "schedules_month/1");
    await runReadCase(page, "Cobertura de horarios del mes que viene.", ["horario", "mes", "día", "cobertura"], "schedules_month/2", { allowEmptyMarkers: true });
    await runReadCase(page, "¿Cuántos trabajadores hay asignados cada día este mes?", ["horario", "mes", "día", "trabajador", "personal"], "schedules_month/3", { allowEmptyMarkers: true });
  });

  test("schedules_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Asigna el turno de 09:00 a 15:00 a un miembro mañana.", ["horario", "turno", "confirmar", "confirmación", "miembro"], "schedules_create/1");
    await runWriteCase(page, "Crea un horario sin miembro.", ["horario", "miembro", "obligator", "confirmar"], "schedules_create/2");
    await runWriteCase(page, "Asigna un horario de 15:00 a 09:00.", ["horario", "hora", "confirmar", "inválid"], "schedules_create/3");
  });

  test("schedules_update (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Cambia la hora de salida de un horario.", ["horario", "hora", "confirmar", "confirmación", "actualizar"], "schedules_update/1");
    await runWriteCase(page, "Actualiza el horario con id 999999.", ["horario", "confirmar", "id", "actualizar"], "schedules_update/2");
    await runWriteCase(page, "Cambia el horario de un miembro la semana que viene.", ["horario", "hora", "confirmar"], "schedules_update/3");
  });

  test("schedules_delete (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Elimina un horario de mañana.", ["horario", "eliminar", "confirmar", "confirmación"], "schedules_delete/1");
    await runWriteCase(page, "Borra el horario con id 999999.", ["horario", "eliminar", "confirmar", "id"], "schedules_delete/2");
    await runWriteCase(page, "Quita el turno asignado a un miembro.", ["horario", "eliminar", "confirmar"], "schedules_delete/3");
  });
});
