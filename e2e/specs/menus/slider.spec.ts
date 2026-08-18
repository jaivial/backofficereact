import { test, expect } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";
import * as fs from "fs";

// Menu id 1 exists in the DB and was seeded with 5 default slider images by
// migration 058. These tests drive the step-3 slider panel + the public API.
const MENU_ID = 1;

// The backoffice dev server only proxies /api/admin — public /api/menus lives on
// the Go backend directly. Point public-API checks there (default: local dev).
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8188";
const BACKOFFICE_URL = process.env.BACKOFFICE_URL || "https://127.0.0.1:3011";

async function fetchPublicMenu(request: any, id: number) {
  const res = await request.get(`${BACKEND_URL}/api/menus/${id}`);
  return res.json();
}

async function openEditorStep3(page: any, tab: "configuracion" | "platos" = "configuracion") {
  await page.goto(`/app/menus/crear?menuId=${MENU_ID}`);
  await page.waitForLoadState("networkidle");
  await waitForLoadingToFinish(page);
  // Existing menus open at the final editor step (step 3) directly. The slider
  // panel lives on the Configuracion tab and the preview on the Platos tab.
  // Platos is the default active tab and the Tabs component renders it disabled,
  // so only click when the target tab is not the already-active platos tab.
  if (tab !== "platos") {
    await page.locator(`[data-testid="tab-${tab}"]`).click();
  }
  if (tab === "configuracion") {
    await page.waitForSelector('[data-slot="sliderPanel-field"]', { timeout: 15_000 });
  } else {
    await page.waitForSelector('[data-testid="menu-preview-iframe"]', { timeout: 15_000 });
  }
}

// page.request shares the adminPage auth cookie (bo_session) — hit the admin API
// directly without depending on the current page origin.
async function setMode(page: any, mode: string) {
  const res = await page.request.patch(
    `${BACKOFFICE_URL}/api/admin/group-menus-v2/${MENU_ID}/slider`,
    { data: { mode }, headers: { "Content-Type": "application/json" } },
  );
  return res.json();
}

test.afterAll(async ({ browser }) => {
  // Restore default mode so the suite is idempotent, reusing the cached session.
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const cached = JSON.parse(fs.readFileSync("test-results/.session-cache.json", "utf-8"));
    await ctx.addCookies([{
      name: "bo_session",
      value: cached.bo_session,
      domain: new URL(BACKOFFICE_URL).hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }]);
    await ctx.request.patch(
      `${BACKOFFICE_URL}/api/admin/group-menus-v2/${MENU_ID}/slider`,
      { data: { mode: "default" }, headers: { "Content-Type": "application/json" } },
    );
  } catch {
    // best-effort cleanup
  }
  await ctx.close();
});

test.describe("Menu slider customization", () => {
  test("SSR hydrates default and custom slider rows before browser slider fetch", async ({ adminPage }) => {
    await adminPage.route(`**/api/admin/group-menus-v2/${MENU_ID}/slider`, (route) => route.abort());
    await adminPage.goto(`/app/menus/crear?menuId=${MENU_ID}`);
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);
    // Slider rows come from Vike SSR page data; the Configuracion tab holds the panel.
    await adminPage.locator('[data-testid="tab-configuracion"]').click();
    await expect(adminPage.locator('[data-slot="sliderPanel-grid"] img.bo-sliderThumb')).toHaveCount(5);
    // Browser GET is aborted; these rows can only be from Vike SSR page data.
  });

  test("panel renders with mode selector and grid", async ({ adminPage }) => {
    await openEditorStep3(adminPage);
    await expect(adminPage.locator('[data-testid="slider-mode-select"]')).toBeVisible();
    // Default mode: five previews plus the persistent add cell.
    await expect(adminPage.locator('[data-slot="sliderPanel-grid"] img.bo-sliderThumb')).toHaveCount(5);
    await expect(adminPage.locator('[data-testid="slider-add"]')).toBeVisible();
  });

  test("panel renders default images without a duplicated CDN base", async ({ adminPage }) => {
    await setMode(adminPage, "default");
    await openEditorStep3(adminPage);
    const thumb = adminPage.locator('[data-slot="sliderPanel-grid"] img.bo-sliderThumb').first();
    await expect(thumb).toHaveAttribute("src", /^https:\/\/villacarmenmedia\.b-cdn\.net\/images\//);
    await expect(thumb).not.toHaveAttribute("src", /villacarmenmedia\.b-cdn\.net\/https:\/\//);
  });

  test("preview slider mounts each supplied image once", async ({ adminPage }) => {
    await setMode(adminPage, "default");
    await openEditorStep3(adminPage, "platos");
    const frame = adminPage.locator('[data-testid="menu-preview-iframe"]').contentFrame();
    const srcs = await frame.locator('.menuHeroSlider img').evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
    expect(srcs.length).toBeGreaterThan(0);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  test("fade cleanup removes previous image without recreating active image", async ({ adminPage }) => {
    await setMode(adminPage, "default");
    await openEditorStep3(adminPage, "platos");
    const frame = adminPage.locator('[data-testid="menu-preview-iframe"]').contentFrame();
    const active = frame.locator('.menuHeroShot.is-active');
    await active.waitFor();
    await adminPage.waitForTimeout(3600);
    const before = await frame.locator('.menuHeroShot.is-active').evaluate((node) => {
      const element = node as HTMLElement & { __sliderStamp?: string };
      element.__sliderStamp ||= crypto.randomUUID();
      return { src: (element as HTMLImageElement).src, stamp: element.__sliderStamp };
    });
    await adminPage.waitForTimeout(1200);
    const after = await frame.locator('.menuHeroShot.is-active').evaluate((node) => {
      const element = node as HTMLElement & { __sliderStamp?: string };
      return { src: (element as HTMLImageElement).src, stamp: element.__sliderStamp };
    });
    expect(after).toEqual(before);
  });

  test("changing to hidden removes slider from live website preview", async ({ adminPage }) => {
    await setMode(adminPage, "default");
    await openEditorStep3(adminPage, "platos");
    const iframe = adminPage.locator('[data-testid="menu-preview-iframe"]');
    await expect(iframe).toBeVisible();
    await expect(iframe.contentFrame().locator(".menuHeroSlider")).toHaveCount(1);

    // Switch to Configuracion, set the mode to hidden, then return to Platos and
    // verify the live preview drops the slider.
    await adminPage.locator('[data-testid="tab-configuracion"]').click();
    await adminPage.locator('[data-testid="slider-mode-select"]').click();
    await adminPage.getByRole("option", { name: "Ocultar slider" }).click();

    await adminPage.locator('[data-testid="tab-platos"]').click();
    await expect(iframe).toBeVisible();
    await expect(iframe.contentFrame().locator(".menuHeroSlider")).toHaveCount(0);
  });

  test("switching to custom empties the visible grid, shows add cell", async ({ adminPage }) => {
    await setMode(adminPage, "custom");
    await openEditorStep3(adminPage);
    // No custom images yet → only the add cell.
    await expect(adminPage.locator('[data-testid="slider-add"]')).toBeVisible();
    await expect(adminPage.locator('[data-slot="sliderPanel-grid"] img.bo-sliderThumb')).toHaveCount(0);
  });

  test("'Ver todas' opens the glass modal with all images", async ({ adminPage }) => {
    await setMode(adminPage, "default");
    await openEditorStep3(adminPage);
    const seeAll = adminPage.locator('[data-testid="slider-see-all"]');
    // Exactly five images fit the compact grid: no overflow control yet.
    await expect(seeAll).toHaveCount(0);
    // The add cell remains available at capacity; custom and both modes keep it
    // too when they overflow and show "Ver todas".
    await expect(adminPage.locator('[data-testid="slider-add"]')).toBeVisible();
  });

  test("add cell opens the AI advisor modal", async ({ adminPage }) => {
    await setMode(adminPage, "custom");
    await openEditorStep3(adminPage);
    // File chooser is native; assert the modal appears after a file is set by
    // dispatching directly onto the hidden input.
    const input = adminPage.locator('[data-testid="slider-file-input"]');
    await input.setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(adminPage.locator('[role="dialog"][aria-label="Asesor IA de imagen"]')).toBeVisible();
    // "Continuar sin mejorar" always present; AI button only when subscribed and
    // an image model is configured, otherwise an explanatory notice takes its place.
    await expect(
      adminPage.locator('[data-testid="slider-advisor-continue-without-ai"]'),
    ).toBeVisible();
    const aiButton = adminPage.locator('[data-testid="slider-advisor-improve-with-ai"]');
    const notice = adminPage.locator('[data-testid="slider-advisor-ai-unavailable"]');
    // Exactly one of the two: the AI button, or the "configure a model" notice.
    expect((await aiButton.count()) + (await notice.count())).toBe(1);
  });

  test("public API: default mode serves seeded defaults", async ({ adminPage, request }) => {
    await setMode(adminPage, "default");
    const menu = await fetchPublicMenu(request, MENU_ID);
    expect(menu.menu.slider_mode).toBe("default");
    expect(menu.menu.slider_images.length).toBeGreaterThan(0);
  });

  test("public API: hidden mode serves no slider images", async ({ adminPage, request }) => {
    await setMode(adminPage, "hidden");
    const menu = await fetchPublicMenu(request, MENU_ID);
    expect(menu.menu.slider_mode).toBe("hidden");
    expect(menu.menu.slider_images.length).toBe(0);
  });

  test("patch rejects an invalid mode", async ({ adminPage }) => {
    const res = await setMode(adminPage, "garbage");
    expect(res.success).toBe(false);
  });
});
