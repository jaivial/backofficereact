import { test } from "@playwright/test";
import { openChat, runReadCase, runWriteCase } from "../../helpers/forkyTools";

test.describe("Forky tools · miembros y estado de cuenta", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await openChat(page);
  });

  test("members_list (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Lista los miembros del personal.", ["miembro", "personal", "nombre", "email"], "members_list/1");
    await runReadCase(page, "¿Quiénes forman parte del equipo?", ["miembro", "personal", "nombre", "equipo"], "members_list/2");
    await runReadCase(page, "Miembros activos del restaurante.", ["miembro", "personal", "nombre", "activo"], "members_list/3");
  });

  test("member_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Obtén el miembro con id 1.", ["miembro", "nombre", "email", "personal"], "member_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Detalles del miembro con id 2.", ["miembro", "nombre", "personal"], "member_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Obtén el miembro con id 999999.", ["miembro", "no", "no encontrado", "id"], "member_get/3", { allowEmptyMarkers: true });
  });

  test("member_balance_get (3 edge cases)", async ({ page }) => {
    await runReadCase(page, "Estado de cuenta de un miembro del personal.", ["saldo", "balance", "horas", "miembro", "trimestre"], "member_balance_get/1", { allowEmptyMarkers: true });
    await runReadCase(page, "Balance trimestral de un trabajador.", ["saldo", "balance", "horas", "trimestre"], "member_balance_get/2", { allowEmptyMarkers: true });
    await runReadCase(page, "Estado de cuenta del miembro con id 1.", ["saldo", "balance", "horas", "miembro"], "member_balance_get/3", { allowEmptyMarkers: true });
  });

  test("member_compensation_create (3 edge cases)", async ({ page }) => {
    await runWriteCase(page, "Registra un periodo salarial para un miembro.", ["salario", "compensación", "confirmar", "confirmación", "miembro"], "member_compensation_create/1");
    await runWriteCase(page, "Añade una compensación mensual a un trabajador.", ["salario", "compensación", "mensual", "confirmar"], "member_compensation_create/2");
    await runWriteCase(page, "Registra un salario sin importe.", ["salario", "compensación", "confirmar", "importe", "obligator"], "member_compensation_create/3");
  });
});
