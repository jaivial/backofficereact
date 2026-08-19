import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Forky E2E helpers for the real app (backoffice-dev.menustudioai.com).
 *
 * The MiniMax backend rate-limits by IP (default 20 messages/min), so helpers
 * pace prompts accordingly and each prompt waits for its reply to finish.
 */

export const FORKY_ORB_WAIT_MS = 4000;
export const FORKY_PROMPT_TIMEOUT = 90_000;

/**
 * The tool suite drives the REAL MiniMax LLM against a live backend, so it is
 * opt-in only: set FORKY_REAL_TOOLS_E2E=1 to run it. It must never run
 * implicitly in CI (slow, costs LLM tokens, per-IP rate limits).
 */
export const forkyToolsEnabled = process.env.FORKY_REAL_TOOLS_E2E === "1";

/** The Forky composer is the literal beautifului.dev PromptBar; its textarea
 * and send button are addressed by aria-label (no data-testids inside the
 * verbatim component). */
export function forkyComposer(page: Page): Locator {
  return page.getByLabel("Prompt", { exact: true });
}

export function forkySendButton(page: Page): Locator {
  return page.getByLabel("Send", { exact: true });
}

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

/** Log in via the page-origin API (same pattern as the session fixture). */
export async function loginAsAdmin(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const login = await page.evaluate(
    async ({ email, password }) => {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: email, password }),
      });
      return { ok: res.ok, body: await res.json() };
    },
    { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD }
  );
  expect(login.ok && (login.body as { success?: boolean })?.success, `login failed: ${JSON.stringify(login.body)}`).toBeTruthy();
}

/** Navigate to the dashboard and wait for the Forky orb to be ready. */
export async function gotoDashboard(page: Page) {
  await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
  const ok = await page
    .waitForFunction(
      () => {
        const el = document.querySelector<HTMLElement>('[data-testid="forky-button"]');
        return el !== null && Object.keys(el).some((key) => key.startsWith("__reactProps"));
      },
      undefined,
      { timeout: 30_000 }
    )
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    // Retry once: some loads are slow on the dev server.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLElement>('[data-testid="forky-button"]');
        return el !== null && Object.keys(el).some((key) => key.startsWith("__reactProps"));
      },
      undefined,
      { timeout: 30_000 }
    );
  }
  // The user directive: the thinking orb needs ~4s to load before opening.
  await page.waitForTimeout(FORKY_ORB_WAIT_MS);
}

/** Open the Forky modal via a native DOM click (motion/WAPA transform-safe). */
export async function openForkyModal(page: Page) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-testid="forky-button"]')?.click();
  });
  await expect(page.getByTestId("forky-modal")).toBeVisible({ timeout: 15_000 });
  await expect(forkyComposer(page)).toBeVisible({ timeout: 15_000 });
}

/** Close the Forky modal if open. */
export async function closeForkyModal(page: Page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
}

/** Full setup for a tool test: login → dashboard → open Forky chat. */
export async function openChat(page: Page) {
  await loginAsAdmin(page);
  await gotoDashboard(page);
  await openForkyModal(page);
}

/** Type the prompt through the keyboard so the assistant-ui store always
 * registers it (native setter/fill are flaky against the React controlled
 * textarea). Clears first via the native setter. */
async function typeComposer(page: Page, composer: Locator, prompt: string) {
  await composer.click();
  await composer.evaluate((el) => {
    const proto = window.HTMLTextAreaElement?.prototype ?? window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await composer.pressSequentially(prompt, { delay: 12 });
}

/** Send one prompt and wait for the assistant reply to finish streaming.
 * Returns the full transcript text (all messages). */
export async function sendPrompt(page: Page, prompt: string): Promise<string> {
  const composer = forkyComposer(page);
  const send = forkySendButton(page);
  // Typing can race the store binding right after the modal opens; retry, and
  // as a last resort reload for a fresh composer (session cookie persists).
  for (let attempt = 0; attempt < 3; attempt++) {
    await typeComposer(page, composer, prompt);
    const ok = await expect(composer).toHaveValue(prompt, { timeout: 3_000 }).then(() => true).catch(() => false);
    const enabled = await send.isEnabled().catch(() => false);
    if (ok && enabled) {
      const before = await lastAssistantText(page);
      await send.click();
      await expect(composer).toHaveValue("", { timeout: 10_000 });
      await waitForNewAssistantMessage(page, before);
      await waitForStableReply(page);
      return transcriptText(page);
    }
    await page.waitForTimeout(500);
    if (attempt === 1) {
      // Stale composer store: reload the dashboard for a clean state.
      await gotoDashboard(page);
      await openForkyModal(page);
    }
  }
  await expect(composer).toHaveValue(prompt);
  await expect(send).toBeEnabled({ timeout: 8_000 });
  const before = await lastAssistantText(page);
  await send.click();
  await expect(composer).toHaveValue("", { timeout: 10_000 });
  await waitForNewAssistantMessage(page, before);
  await waitForStableReply(page);
  return transcriptText(page);
}

async function waitForNewAssistantMessage(page: Page, before: string) {
  await page.waitForFunction(
    (prev) => {
      const nodes = document.querySelectorAll('[data-testid="forky-assistant-message"]');
      if (nodes.length === 0) return false;
      const last = nodes[nodes.length - 1];
      return last.textContent !== prev && (last.textContent ?? "").trim().length > 0;
    },
    before,
    { timeout: FORKY_PROMPT_TIMEOUT }
  );
}

/** Return the text of the last assistant message (or empty). */
export async function lastAssistantText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-testid="forky-assistant-message"]');
    return nodes.length ? (nodes[nodes.length - 1].textContent ?? "") : "";
  });
}

async function waitForStableReply(page: Page) {
  let prev = await lastAssistantText(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const cur = await lastAssistantText(page);
    if (cur === prev) return;
    prev = cur;
  }
}

/** Full transcript text of the Forky chat. */
export async function transcriptText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="forky-messages-container"]');
    return container ? (container.textContent ?? "") : "";
  });
}

/**
 * Assert a tool reply looks successful: no backend/tool errors surfaced and at
 * least one domain marker present.
 */
export function assertToolReply(text: string, markers: string[], label: string) {
  const textNorm = text.toLowerCase();
  const errorMarkers = [
    "herramienta desconocida",
    "permiso insuficiente",
    "autenticación requerida",
    "failed to",
    "no existe la columna",
    "error técnico",
    "requiere confirmed",
    "confirmation_token requerido",
    "minimax http",
  ];
  for (const e of errorMarkers) {
    expect(textNorm, `${label} surfaced error marker "${e}"`).not.toContain(e);
  }
  const found = markers.filter((m) => textNorm.includes(m.toLowerCase()));
  expect(found.length, `${label} no tool-data marker found in: ${text.slice(0, 400)}`).toBeGreaterThan(0);
}

/** Rate-limit pacing: wait so the IP stays under the backend per-minute cap. */
export async function pace(page: Page) {
  await page.waitForTimeout(3_500);
}

const READ_ERROR_MARKERS = [
  "herramienta desconocida",
  "permiso insuficiente",
  "autenticación requerida",
  "failed to",
  "no existe la columna",
  "error técnico",
  "minimax http",
];

const WRITE_ERROR_MARKERS = [
  "herramienta desconocida",
  "permiso insuficiente",
  "autenticación requerida",
  "failed to",
  "no existe la columna",
  "minimax http",
];

function markersPresent(text: string, markers: string[]): string[] {
  const t = text.toLowerCase();
  return markers.filter((m) => t.includes(m.toLowerCase()));
}

/**
 * Run one edge-case prompt for a READ tool: send, assert no error markers and
 * at least one domain marker present.
 */
export async function runReadCase(
  page: Page,
  prompt: string,
  markers: string[],
  label: string,
  opts?: { allowEmptyMarkers?: boolean }
) {
  const text = await sendPrompt(page, prompt);
  const t = text.toLowerCase();
  for (const e of READ_ERROR_MARKERS) {
    expect(t, `${label} surfaced error "${e}" in: ${text.slice(0, 300)}`).not.toContain(e);
  }
  const found = markersPresent(text, markers);
  if (!opts?.allowEmptyMarkers) {
    expect(found.length, `${label} no tool-data marker in: ${text.slice(0, 400)}`).toBeGreaterThan(0);
  }
  return text;
}

/**
 * Run one edge-case prompt for a WRITE tool. Writes always need a
 * server-side confirmation token, so the reply must either show the tool was
 * invoked and confirmation is required, or surface a validation message — but
 * never an unknown tool / permission / transport error.
 */
export async function runWriteCase(page: Page, prompt: string, markers: string[], label: string) {
  const text = await sendPrompt(page, prompt);
  const t = text.toLowerCase();
  for (const e of WRITE_ERROR_MARKERS) {
    expect(t, `${label} surfaced error "${e}" in: ${text.slice(0, 300)}`).not.toContain(e);
  }
  const found = markersPresent(text, markers);
  // The model may phrase a confirmation request without the domain word; accept
  // confirmation verbs as evidence the tool was invoked.
  const confirmPhrase = ["confirm", "confirmación", "aprobación", "autoriz", "validar", "dame el token"].some((c) => t.includes(c));
  expect(
    found.length > 0 || confirmPhrase,
    `${label} no domain marker nor confirmation phrase in: ${text.slice(0, 400)}`
  ).toBeTruthy();
  return text;
}
