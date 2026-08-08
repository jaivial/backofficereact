import { test, expect, type Page } from "@playwright/test";
import {
  gotoDashboard,
  openForkyModal,
  sendPrompt,
  assertToolReply,
  forkyToolsEnabled,
} from "../../helpers/forkyTools";

// Quick connectivity probe for the real dev app. Gated behind the same opt-in
// flag as the tool suite (it hits the real backend/LLM).
test.describe("Forky probe", () => {
  test.skip(!forkyToolsEnabled, "requires FORKY_REAL_TOOLS_E2E=1");
  test("probe: forky orb + one tool prompt on the real app", async ({ page }) => {
  test.setTimeout(180_000);
  // Log in through the API on the page origin.
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }),
    });
    return { ok: res.ok, body: await res.json() };
  });
  expect(login.ok && login.body?.success, `login failed: ${JSON.stringify(login.body)}`).toBeTruthy();

  await gotoDashboard(page);
  await openForkyModal(page);

  const text = await sendPrompt(page, "¿Cómo se llama el restaurante y cuál es su teléfono?");
  assertToolReply(text, ["villa carmen", "restaurante", "teléfono", "phone"], "probe/restaurant_info");
});
});
