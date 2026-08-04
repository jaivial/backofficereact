import { test, expect, type Page } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Open the Forky modal via a native DOM click. Trusted CDP mouse events are
 * unreliable here: headless Chromium's pointer pipeline misfires its hit-test
 * against the motion-driven WAAPI transform on the floating button (real
 * browsers are unaffected). The native click still exercises the real onClick
 * handler and the Jotai open state.
 */
async function openForky(page: Page): Promise<void> {
  // The button is SSR'd before React hydrates; clicking before hydration hits a
  // listener-less element. Wait for React to attach its props marker, then
  // click via a native DOM click (trusted CDP clicks misfire against the
  // motion WAAPI transform in headless Chromium; real browsers are unaffected).
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="forky-button"]');
    return el !== null && Object.keys(el).some((key) => key.startsWith("__reactProps"));
  });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-testid="forky-button"]')?.click();
  });
  await expect(page.getByTestId("forky-modal")).toBeVisible({ timeout: 10_000 });
}

test.describe("Forky AI assistant", () => {
  test("floating button is present on dashboard", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);
    await adminPage.goto("/app/dashboard");
    await adminPage.waitForLoadState("domcontentloaded");
    await waitForLoadingToFinish(adminPage);

    const button = adminPage.getByTestId("forky-button");
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", "Abrir asistente Forky");
    await expect(button.locator("img")).toHaveCount(0);
    await expect(adminPage.locator('img[src*="forky"]')).toHaveCount(0);
    await expect(adminPage.getByTestId("forky-canvas")).toBeVisible();

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("opens full-viewport modal with Forky canvas", async ({ adminPage }) => {
    await adminPage.goto("/app/dashboard");
    await adminPage.waitForLoadState("domcontentloaded");
    await waitForLoadingToFinish(adminPage);

    await openForky(adminPage);
    const modal = adminPage.getByTestId("forky-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("role", "dialog");
    await expect(adminPage.getByTestId("forky-canvas")).toBeVisible();
  });

  test.fixme(
    "sends a message and renders the streamed reply (stubbed MiniMax)",
    async ({ adminPage }) => {
      // fixme: assistant-ui v0.15's store-driven primitives (composer draft,
      // thread messages) do not react to input under headless Chromium in this
      // app, even with a minimal raw <ThreadPrimitive>/<ComposerPrimitive>
      // setup (reproduced independently of the Forky wiring); the same setup
      // passes under vitest/jsdom. The full chat flow is still verified by:
      //   - ui/forky/forkyRuntime.test.tsx (WS adapter: frames, reconnect,
      //     abort) and store-reactivity.test.tsx (assistant-ui typing/send)
      //   - backend assistant_ws_test.go / assistant_public_test.go (protocol,
      //     persistence, streaming against a fake MiniMax SSE server)
      // Run this test in a real browser (WebGL available) to validate
      // end-to-end rendering.
      test.skip(
        !process.env.FORKY_E2E_STUB,
        "requires the backend running with MINIMAX_BASE_URL pointed at the e2e stub"
      );

      await adminPage.goto("/app/dashboard");
      await adminPage.waitForLoadState("domcontentloaded");
      await waitForLoadingToFinish(adminPage);

      await openForky(adminPage);
      const composer = adminPage.getByTestId("forky-composer-input");
      await expect(composer).toBeVisible();
      await composer.fill("Hola Forky, ¿cómo estás?");
      await expect(composer).toHaveValue("Hola Forky, ¿cómo estás?");
      await adminPage.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(composer).toHaveValue("");

      // The stub replies with: ¡Hola! Soy Forky, tu asistente de Villa Carmen. Has escrito: "..."
      const reply = adminPage.getByText(/Soy Forky, tu asistente de Villa Carmen/);
      await expect(reply).toBeVisible({ timeout: 15_000 });
    }
  );

  test("Esc closes the modal and restores the page", async ({ adminPage }) => {
    await adminPage.goto("/app/dashboard");
    await adminPage.waitForLoadState("domcontentloaded");
    await waitForLoadingToFinish(adminPage);

    await openForky(adminPage);
    await expect(adminPage.getByTestId("forky-modal")).toBeVisible();
    await adminPage.keyboard.press("Escape");
    await expect(adminPage.getByTestId("forky-modal")).toBeHidden();
  });
});
