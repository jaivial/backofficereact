import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

async function login(page: import("@playwright/test").Page) {
  const origin = new URL(page.url()).origin;
  const r = await page.evaluate(
    async ({ url, email, password }: any) => {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
        credentials: "include",
      });
      return (await res.json()).success;
    },
    { url: `${origin}/api/admin/login`, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  );
  expect(r).toBe(true);
}

test.describe("Miembros - Mobile add member", () => {
  test("after adding member via modal, card renders in grid above nav", async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 },
      isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "load" });
    await login(page);
    await page.goto("/app/miembros", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="app-layout-main"]', { timeout: 15_000 });

    // Open create modal and add a member
    await page.click('[data-testid="add-member-button"]');
    await page.waitForSelector('[data-testid="member-create-firstname-input"]', { timeout: 5_000 });
    await page.fill('[data-testid="member-create-firstname-input"]', "TestMobile");
    await page.fill('[data-testid="member-create-lastname-input"]', "NoNav");
    await page.fill('[data-testid="member-create-email-input"]', `testmob${Date.now()}@e2e.com`);
    await page.click('[data-testid="member-create-submit-button"]');

    // Wait for modal to close and new card to appear
    await page.waitForTimeout(2_000);
    await page.waitForSelector('.bo-memberCard', { timeout: 10_000 });

    // Scroll main to bottom to see the new card
    await page.evaluate(() => {
      const main = document.querySelector('[data-testid="app-layout-main"]');
      if (main) main.scrollTop = main.scrollHeight;
    });
    await page.waitForTimeout(500);

    // Verify last visible card bottom is above nav top
    const result = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="app-layout-main"]');
      const nav = document.querySelector('[data-slot="sidebar-nav-mobile"]');
      if (!main || !nav) return { error: 'missing el' };

      const navTop = nav.getBoundingClientRect().top;
      const mainRect = main.getBoundingClientRect();

      const cards = main.querySelectorAll('.bo-memberCard');
      const visibleCards = Array.from(cards).filter(c => {
        const r = c.getBoundingClientRect();
        return r.top < mainRect.bottom && r.bottom > mainRect.top;
      });

      if (!visibleCards.length) return { error: 'no visible cards', navTop, mainBottom: mainRect.bottom };

      const lastCard = visibleCards[visibleCards.length - 1];
      const lastRect = lastCard.getBoundingClientRect();
      return {
        navTop,
        mainBottom: mainRect.bottom,
        lastCardBottom: lastRect.bottom,
        lastCardFitsAboveNav: lastRect.bottom <= navTop,
        lastCardText: lastCard.textContent?.trim().slice(0, 25),
        visibleCardCount: visibleCards.length,
        mainScrollBottom: main.scrollTop + main.clientHeight,
        mainScrollHeight: main.scrollHeight,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.lastCardFitsAboveNav).toBe(true);

    await context.close();
  });
});
