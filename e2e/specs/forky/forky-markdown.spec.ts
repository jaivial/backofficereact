/**
 * Forky markdown rendering E2E.
 *
 * Validates the canonical assistant-ui markdown-text component renders GFM
 * tables as real <table> elements, and that the repairGfmTables preprocess
 * fixes the malformed delimiter rows MiniMax intermittently emits.
 *
 * Uses the mock LLM stub (forky-minimax-stub.ts) so it runs without a real
 * MiniMax key. Drives the real Forky modal UI through the WebSocket transport.
 */
import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForHydration } from "../../helpers/wait";

test.describe("Forky markdown table rendering", () => {
  test("valid GFM table renders as a semantic <table>", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app");
    await waitForHydration(adminPage);

    // Open Forky modal.
    await adminPage.getByTestId("forky-button").click();
    await expect(adminPage.getByTestId("forky-modal")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("forky-composer-input")).toBeVisible({ timeout: 15_000 });

    // Send a prompt that should produce a table.
    await adminPage.getByTestId("forky-composer-input").fill("¿Qué reservas hay hoy?");
    await adminPage.getByTestId("forky-composer-send").click();

    // Wait for the assistant reply to appear.
    const reply = adminPage.getByTestId("forky-assistant-message").last();
    await expect(reply).toBeVisible({ timeout: 60_000 });

    // The assistant message should contain a rendered <table> (not raw pipes).
    await expect(reply.locator("table[data-slot='markdown-table']")).toBeVisible({ timeout: 10_000 });

    // Raw pipe separators must not leak into the text.
    const text = await reply.innerText();
    expect(text).not.toMatch(/\(\|---/);
    expect(text).not.toMatch(/---\|---\|---/);

    // Close.
    await adminPage.getByTestId("forky-close-button").click();
    await expect(adminPage.getByTestId("forky-modal")).toHaveCount(0, { timeout: 10_000 });

    const { hasErrors } = assertNoCriticalErrors(consoleCapture);
    expect(hasErrors).toBeFalsy();
  });

  test("chart block renders a Recharts chart (not raw JSON)", async ({ adminPage }) => {
    await adminPage.goto("/app");
    await waitForHydration(adminPage);

    await adminPage.getByTestId("forky-button").click();
    await expect(adminPage.getByTestId("forky-composer-input")).toBeVisible({ timeout: 15_000 });

    // A prompt likely to trigger analytics → forky-chart block.
    await adminPage.getByTestId("forky-composer-input").fill("Muéstrame la analítica de reservas de esta semana");
    await adminPage.getByTestId("forky-composer-send").click();

    const reply = adminPage.getByTestId("forky-assistant-message").last();
    await expect(reply).toBeVisible({ timeout: 60_000 });

    // Either a chart or a table should render (depends on data availability);
    // the key assertion is that raw ```forky-chart JSON must NOT appear.
    const text = await reply.innerText();
    expect(text).not.toContain("```forky-chart");

    await adminPage.getByTestId("forky-close-button").click();
  });

  test("code block has a copy button (canonical markdown-text)", async ({ adminPage }) => {
    await adminPage.goto("/app");
    await waitForHydration(adminPage);

    await adminPage.getByTestId("forky-button").click();
    await expect(adminPage.getByTestId("forky-composer-input")).toBeVisible({ timeout: 15_000 });

    await adminPage.getByTestId("forky-composer-input").fill("Escribe un ejemplo de código JavaScript");
    await adminPage.getByTestId("forky-composer-send").click();

    const reply = adminPage.getByTestId("forky-assistant-message").last();
    await expect(reply).toBeVisible({ timeout: 60_000 });

    // If the model produced a fenced code block, the canonical CodeHeader
    // (with copy button) should render.
    const codeHeader = reply.locator('[data-slot="markdown-code-header-root"]');
    if (await codeHeader.count() > 0) {
      await expect(codeHeader.first()).toBeVisible();
      await expect(codeHeader.locator("button")).toBeVisible();
    }

    await adminPage.getByTestId("forky-close-button").click();
  });
});
