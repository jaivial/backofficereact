import { test, expect } from "../../fixtures/session";

// Pantallas 1-4: login y páginas públicas de reserva/auth.
// Usa interacciones reales de usuario (click/fill/navegación), no solo API.
// Los formularios requieren hidratación React: esperar networkidle antes de interactuar.

test.describe("@edge Auth & public pages", () => {
  test.describe("Login edge cases", () => {
    test("email inexistente muestra error y permanece en /login", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login", { waitUntil: "networkidle" });

      await page.getByTestId("login-identifier-input").fill("nobody@villacarmen.com");
      await page.getByTestId("login-password-input").fill("wrongpass");
      await page.getByTestId("login-submit-btn").click();

      // Toast de error visible y seguimos en /login
      await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-ui="toast"]')).toBeVisible({ timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/login");
      await context.close();
    });

    test("email valido + password incorrecta muestra error", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login", { waitUntil: "networkidle" });

      await page.getByTestId("login-identifier-input").fill("admin@villacarmen.com");
      await page.getByTestId("login-password-input").fill("not-the-password");
      await page.getByTestId("login-submit-btn").click();

      await expect(page.locator('[data-ui="toast"]')).toBeVisible({ timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/login");
      await context.close();
    });

    test("identificador con espacios alrededor no rompe el flujo", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login", { waitUntil: "networkidle" });

      await page.getByTestId("login-identifier-input").fill("  admin@villacarmen.com  ");
      await page.getByTestId("login-password-input").fill("wrongpass");
      await page.getByTestId("login-submit-btn").click();

      // Sin trim el login falla (toast) pero NO debe crashear ni navegar fuera del dominio.
      await page.waitForTimeout(1500);
      const url = new URL(page.url());
      expect(url.hostname).toBe("localhost");
      await context.close();
    });
  });

  test.describe("Páginas públicas de reserva: confirm / cancel / update-rice", () => {
    const cases = [
      { path: "/confirm", backHomeTestId: "confirm-page-back-home-error" },
      { path: "/cancel", backHomeTestId: "cancel-page-back-home-error" },
      { path: "/update-rice", backHomeTestId: "update-rice-page-back-home-link" },
    ];

    for (const { path, backHomeTestId } of cases) {
      test(`${path}: sin id muestra error controlado`, async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("response", (r) => {
          if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
        });
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(backHomeTestId)).toBeVisible({ timeout: 15_000 });
        expect(errors).toEqual([]);
        await context.close();
      });

      test(`${path}: id no numerico muestra error`, async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("response", (r) => {
          if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
        });
        await page.goto(`${path}?id=abc`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(backHomeTestId)).toBeVisible({ timeout: 15_000 });
        expect(errors).toEqual([]);
        await context.close();
      });

      test(`${path}: id inexistente muestra 'no encontrada'`, async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("response", (r) => {
          if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
        });
        await page.goto(`${path}?id=999999999`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(backHomeTestId)).toBeVisible({ timeout: 15_000 });
        expect(errors).toEqual([]);
        await context.close();
      });
    }
  });

  test.describe("Onboarding", () => {
    test("sin guid (ruta incompleta) muestra 404 controlado", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
      });
      await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Pagina no encontrada").first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
      await context.close();
    });

    test("guid aleatorio muestra error de API sin crash", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
      });
      await page.goto("/onboarding/zz-not-a-real-guid", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("onboarding-page-error-title")).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
      await context.close();
    });
  });

  test.describe("Invitación", () => {
    test("token invalido muestra error + enlace a login", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
      });
      await page.goto("/invitacion/zz-not-a-real-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("invitacion-page-login-link")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/No se pudo validar la invitación/i).first()).toBeVisible();
      expect(errors).toEqual([]);
      await context.close();
    });
  });

  test.describe("Reset password", () => {
    test("token invalido muestra 'Enlace no valido' + login link", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`);
      });
      await page.goto("/reset-password/zz-not-a-real-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("reset-password-page-login-link")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Enlace no válido").first()).toBeVisible();
      expect(errors).toEqual([]);
      await context.close();
    });
  });

  test.describe("Redirecciones", () => {
    test("/ sin sesion redirige a /login", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/login**", { timeout: 10_000 });
      await context.close();
    });

    test("/change-password sin sesion redirige a /login", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/change-password", { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/login**", { timeout: 10_000 });
      await context.close();
    });

    test("/m sin sesion muestra login movil", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/m", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/login/, { timeout: 10_000 });
      await expect(page.locator('form, input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
      await context.close();
    });
  });
});
