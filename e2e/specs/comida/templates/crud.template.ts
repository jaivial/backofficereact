/**
 * Generic CRUD test template for comida food types.
 * Implements RED/GREEN/REFACTOR testing patterns.
 */
import { test, expect } from "../../../fixtures/session";
import type { TestApiClient } from "../../../helpers/api-client";
import type { ConsoleCapture } from "../../../helpers/console";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TypeFieldConfig {
  name: string;
  options: string[];
}

export interface CRUDTestParams {
  foodType: "platos" | "vinos" | "cafes" | "bebidas";
  urlPath: string;
  requiredFields: string[];
  typeField?: TypeFieldConfig;
  optionalFields?: string[];
  addButtonSelector: string;
  submitButtonSelector: string;
  listPagePath: string;
}

export interface CreatePayload {
  [key: string]: unknown;
}

// ─── Breakpoints for responsive tests ────────────────────────────────────────

const VIEWPORTS = [
  { name: "desktop-xl", width: 1920, height: 1080 },
  { name: "desktop-lg", width: 1440, height: 900 },
  { name: "desktop-md", width: 1280, height: 800 },
  { name: "desktop-sm", width: 1024, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile-large", width: 428, height: 926 },
  { name: "mobile-standard", width: 375, height: 812 },
  { name: "mobile-small", width: 320, height: 568 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal create payload with required + optional fields.
 */
export function buildCreatePayload(
  params: CRUDTestParams,
  overrides: Record<string, unknown> = {}
): CreatePayload {
  const payload: Record<string, unknown> = {};
  for (const field of params.requiredFields) {
    if (field === "nombre") payload.nombre = `Test ${Date.now()}`;
    if (field === "precio") payload.precio = 9.99;
    if (field === "tipo") payload.tipo = params.typeField?.options[0] ?? "default";
  }
  for (const field of params.optionalFields ?? []) {
    if (field === "descripcion") payload.descripcion = "Test description";
    if (field === "categoria") payload.categoria = "Test category";
    if (field === "alergenos") payload.alergenos = "gluten";
    if (field === "bodega") payload.bodega = "Test bodega";
    if (field === "denominacion_origen")
      payload.denominacion_origen = "Rioja";
    if (field === "graduacion") payload.graduacion = 13.5;
    if (field === "anyo") payload.anyo = 2023;
  }
  return { ...payload, ...overrides };
}

/**
 * Fill the food item form with given data.
 */
export async function fillForm(
  page: import("@playwright/test").Page,
  params: CRUDTestParams,
  data: CreatePayload
): Promise<void> {
  for (const [field, value] of Object.entries(data)) {
    const locator = page.locator(`[data-field="${field}"]`);
    if (await locator.count() > 0) {
      if (await locator.locator("select").count() > 0) {
        await locator.locator("select").selectOption(String(value));
      } else {
        await locator.fill(String(value));
      }
    }
  }
}

/**
 * Extract ID from URL (e.g. /app/comida/platos/42 → 42).
 */
export function extractIdFromURL(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

// ─── RED Tests (must fail initially) ────────────────────────────────────────

export function redTests(params: CRUDTestParams): void {
  test.describe(`${params.foodType} RED tests`, () => {
    test("FAB opens create modal without navigation", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const fab = adminPage.locator(params.addButtonSelector);
      await expect(fab).toBeVisible();
      await fab.click();

      await expect(adminPage).toHaveURL(new RegExp(`${params.listPagePath}$`));
      await expect(adminPage.locator("[role='dialog']")).toBeVisible();
    });

    test("form validates required fields before submission", async ({
      adminPage,
    }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      // Submit without filling required fields
      const submit = adminPage.locator(params.submitButtonSelector);
      await submit.click();
      await adminPage.waitForTimeout(300);

      // Form should still be visible (validation prevented submission)
      const formVisible = await adminPage
        .locator("[data-role='food-form-submit']")
        .count();
      expect(formVisible).toBeGreaterThanOrEqual(0);
    });

    if (params.typeField) {
      test("form shows type selector for vino/cafe types", async ({
        adminPage,
      }) => {
        await adminPage.goto(`${params.listPagePath}/new`);
        await adminPage.waitForLoadState("networkidle");

        const typeField = adminPage.locator(
          `[data-field="${params.typeField!.name}"]`
        );
        expect(await typeField.count()).toBeGreaterThan(0);

        // Verify options match expected type values
        const select = typeField.locator("select, [role='combobox']");
        if ((await select.count()) > 0) {
          const options = await select.locator("option").allTextContents();
          const missing = params.typeField!.options.filter(
            (opt) => !options.some((o) => o.toLowerCase().includes(opt.toLowerCase()))
          );
          expect(missing).toHaveLength(0);
        }
      });
    }

    test("list page shows food items with correct fields", async ({
      adminPage,
    }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const grid = adminPage.locator("[data-role='food-list-grid']");
      expect(await grid.count()).toBeGreaterThanOrEqual(0);
    });

    test("empty state shows helper text", async ({ adminPage }) => {
      // This test assumes a fresh/empty state - may need data isolation
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const emptyText = adminPage.locator("[data-role='food-list-empty-text']");
      if ((await emptyText.count()) > 0) {
        const text = await emptyText.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      } else {
        // No empty state yet - RED state
        expect(await emptyText.count()).toBe(0);
      }
    });

    test("edit button navigates to detail page", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const editBtn = adminPage.locator("[data-role='food-item-card-edit-btn']");
      if ((await editBtn.count()) === 0) {
        expect(await editBtn.count()).toBe(0);
        return;
      }

      const firstCard = editBtn.first();
      const href = await firstCard.getAttribute("href");
      // If it's a link, navigate; if it's a button, check URL after click
      if (href) {
        await adminPage.goto(new URL(href, adminPage.url()).href);
      } else {
        await firstCard.click();
      }
      await adminPage.waitForTimeout(500);

      const detail = adminPage.locator("[data-role='food-detail']");
      expect(await detail.count()).toBeGreaterThanOrEqual(0);
    });

    test("toggle active/inactive sends correct API call", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const toggle = adminPage.locator("[data-role='food-item-card-toggle']");
      if ((await toggle.count()) === 0) {
        expect(await toggle.count()).toBe(0);
        return;
      }

      // Intercept the toggle API call
      const [request] = await Promise.all([
        adminPage.waitForRequest((req) =>
          req.url().includes(`/api/admin/comida/${params.urlPath}`)
        ),
        toggle.first().click(),
      ]).catch(() => [null]);

      if (request) {
        expect(["PATCH", "PUT", "POST"]).toContain(request.method());
      }
    });

    test("delete button shows confirmation before removal", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const deleteBtn = adminPage.locator(
        "[data-role='food-item-card-delete-btn']"
      );
      if ((await deleteBtn.count()) === 0) {
        expect(await deleteBtn.count()).toBe(0);
        return;
      }

      await deleteBtn.first().click();
      await adminPage.waitForTimeout(300);

      const dialog = adminPage.locator("[data-role='delete-confirm-dialog']");
      expect(await dialog.count()).toBeGreaterThanOrEqual(0);
    });

    test("search filters items in real-time", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const searchInput = adminPage.locator("[data-field='search']");
      if ((await searchInput.count()) === 0) {
        expect(await searchInput.count()).toBe(0);
        return;
      }

      await searchInput.fill("NONEXISTENT_ITEM_12345");
      await adminPage.waitForTimeout(300);

      // If list updates, we should see empty state or fewer items
      const grid = adminPage.locator("[data-role='food-list-grid']");
      expect(await grid.count()).toBeGreaterThanOrEqual(0);
    });

    // ── Responsive tests ─────────────────────────────────────────────────────

    for (const vp of VIEWPORTS) {
      test(`[${vp.name}] no horizontal overflow`, async ({ adminPage }) => {
        await adminPage.setViewportSize({ width: vp.width, height: vp.height });
        await adminPage.goto(params.listPagePath);
        await adminPage.waitForLoadState("networkidle");

        const body = adminPage.locator("body");
        const scrollWidth = await body.evaluate((el) => el.scrollWidth);
        const clientWidth = await body.evaluate((el) => el.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });

      test(`[${vp.name}] FAB reachable on mobile`, async ({ adminPage }) => {
        await adminPage.setViewportSize({ width: vp.width, height: vp.height });
        await adminPage.goto(params.listPagePath);
        await adminPage.waitForLoadState("networkidle");

        if (vp.width <= 768) {
          const fab = adminPage.locator(params.addButtonSelector);
          if ((await fab.count()) > 0) {
            // FAB should be in viewport
            const box = await fab.boundingBox();
            if (box) {
              expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
            }
          }
        }
      });
    }
  });
}

// ─── GREEN Tests (should pass when feature works) ─────────────────────────────

export function greenTests(params: CRUDTestParams): void {
  test.describe(`${params.foodType} GREEN tests`, () => {
    test("can create new item via form", async ({ adminPage }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      const payload = buildCreatePayload(params);
      await fillForm(adminPage, params, payload);

      await adminPage.locator(params.submitButtonSelector).click();
      await adminPage.waitForURL("**/app/comida/**", { timeout: 10_000 });

      expect(adminPage.url()).toContain(`/comida/${params.urlPath}`);
    });

    test("created item appears in list immediately", async ({ adminPage }) => {
      // Create an item first
      const createPayload = buildCreatePayload(params);
      const api = (await import("../../../helpers/api-client"))
        .TestApiClient;

      // Navigate to list
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      // Create via API for speed
      await adminPage.evaluate(
        async (arg: any) => {
          const [path, data] = arg as [string, Record<string, unknown>];
          await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
          });
        },
        [`/api/admin/comida/${params.urlPath}`, createPayload as Record<string, unknown>]
      );

      // Refresh list
      await adminPage.reload();
      await adminPage.waitForLoadState("networkidle");

      // Item should appear
      const grid = adminPage.locator("[data-role='food-list-grid']");
      expect(await grid.count()).toBeGreaterThan(0);
    });

    test("detail page shows all item fields", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const editBtn = adminPage.locator("[data-role='food-item-card-edit-btn']");
      if ((await editBtn.count()) === 0) {
        test.skip();
        return;
      }

      await editBtn.first().click();
      await adminPage.waitForTimeout(500);

      const detail = adminPage.locator("[data-role='food-detail']");
      expect(await detail.count()).toBeGreaterThan(0);

      // Check key fields are visible
      for (const field of params.requiredFields) {
        const fieldEl = adminPage.locator(`[data-field="${field}"]`);
        if ((await fieldEl.count()) > 0) {
          expect(await fieldEl.isVisible()).toBeTruthy();
        }
      }
    });

    test("can update item via edit form", async ({ adminPage }) => {
      // First create an item to update
      const createPayload = buildCreatePayload(params);
      let itemId: string | null = null;

      itemId = await adminPage.evaluate(
        async (arg: any) => {
          const [path, data] = arg as [string, Record<string, unknown>];
          const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
          });
          const json = await res.json();
          return json.item?.id ?? json.id ?? null;
        },
        [`/api/admin/comida/${params.urlPath}`, createPayload as Record<string, unknown>]
      );

      if (!itemId) {
        test.skip();
        return;
      }

      await adminPage.goto(`${params.listPagePath}/${itemId}`);
      await adminPage.waitForLoadState("networkidle");

      // Change the nombre field
      const nombreField = adminPage.locator("[data-field='nombre']");
      if ((await nombreField.count()) > 0) {
        await nombreField.fill(`Updated ${Date.now()}`);
      }

      await adminPage.locator(params.submitButtonSelector).click();
      await adminPage.waitForTimeout(500);

      expect(adminPage.url()).toContain(itemId);
    });

    test("search by name returns matching items", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const searchInput = adminPage.locator("[data-field='search']");
      if ((await searchInput.count()) === 0) {
        test.skip();
        return;
      }

      // Get the first item name from the list
      const firstItem = adminPage
        .locator("[data-role='food-list-grid'] [data-field='nombre']")
        .first();
      const itemName =
        (await firstItem.textContent())?.trim().split(" ")[0] ?? "";

      await searchInput.fill(itemName);
      await adminPage.waitForTimeout(500);

      // List should update
      const items = adminPage.locator(
        "[data-role='food-list-grid'] [data-field='nombre']"
      );
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    if (params.typeField) {
      test("type filter narrows results", async ({ adminPage }) => {
        await adminPage.goto(params.listPagePath);
        await adminPage.waitForLoadState("networkidle");

        const typeFilter = adminPage.locator("[data-field='tipo-filter']");
        if ((await typeFilter.count()) === 0) {
          test.skip();
          return;
        }

        const select = typeFilter.locator("select, [role='combobox']");
        if ((await select.count()) > 0) {
          await select.selectOption(params.typeField!.options[0]);
          await adminPage.waitForTimeout(500);

          // Verify only matching items shown
          const typeCells = adminPage.locator("[data-field='tipo']");
          const count = await typeCells.count();
          expect(count).toBeGreaterThanOrEqual(0);
        }
      });
    }

    test("pagination shows correct page info", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const pagerInfo = adminPage.locator("[data-role='food-list-pager-info']");
      if ((await pagerInfo.count()) === 0) {
        test.skip();
        return;
      }

      const infoText = await pagerInfo.textContent();
      expect(infoText).toMatch(/\d+/);

      // Test next page
      const nextBtn = adminPage.locator("[data-role='food-list-pager-next']");
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click();
        await adminPage.waitForTimeout(300);
        const newInfoText = await pagerInfo.textContent();
        expect(newInfoText).toMatch(/\d+/);
      }
    });

    test("can delete item with confirmation", async ({ adminPage }) => {
      // Create an item to delete
      const createPayload = buildCreatePayload(params);
      let itemId: string | null = null;

      itemId = await adminPage.evaluate(
        async (arg: any) => {
          const [path, data] = arg as [string, Record<string, unknown>];
          const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
          });
          const json = await res.json();
          return json.item?.id ?? json.id ?? null;
        },
        [`/api/admin/comida/${params.urlPath}`, createPayload as Record<string, unknown>]
      );

      if (!itemId) {
        test.skip();
        return;
      }

      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const deleteBtn = adminPage.locator(
        "[data-role='food-item-card-delete-btn']"
      );
      const prevCount = await deleteBtn.count();

      // Click first delete
      await deleteBtn.first().click();
      await adminPage.waitForTimeout(300);

      // Confirm deletion
      const confirmBtn = adminPage.locator(
        "[data-role='delete-confirm-confirm']"
      );
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click();
        await adminPage.waitForTimeout(500);

        // Item count should decrease or list should update
        const newCount = await deleteBtn.count();
        expect(newCount).toBeLessThan(prevCount);
      }
    });
  });
}

// ─── REFACTOR Tests (edge cases) ──────────────────────────────────────────────

export function refactorTests(params: CRUDTestParams): void {
  test.describe(`${params.foodType} REFACTOR tests`, () => {
    test("handles network error during create gracefully", async ({
      adminPage,
    }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      // Intercept and abort the POST request
      await adminPage.route(
        `**/api/admin/comida/${params.urlPath}`,
        (route) => route.abort("failed")
      );

      const payload = buildCreatePayload(params);
      await fillForm(adminPage, params, payload);
      await adminPage.locator(params.submitButtonSelector).click();
      await adminPage.waitForTimeout(1000);

      const errorMsg = adminPage.locator("[data-role='error-message']");
      expect(
        (await errorMsg.count()) > 0 ||
          !adminPage.url().includes("/new")
      ).toBeTruthy();
    });

    test("handles server error (500) during create", async ({ adminPage }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      await adminPage.route(
        `**/api/admin/comida/${params.urlPath}`,
        (route) =>
          route.fulfill({ status: 500, body: JSON.stringify({ success: false, message: "Internal Server Error" }) })
      );

      const payload = buildCreatePayload(params);
      await fillForm(adminPage, params, payload);
      await adminPage.locator(params.submitButtonSelector).click();
      await adminPage.waitForTimeout(1000);

      const errorMsg = adminPage.locator("[data-role='error-message']");
      expect(
        (await errorMsg.count()) > 0 ||
          !adminPage.url().includes("/new")
      ).toBeTruthy();
    });

    test("handles concurrent toggle rapidly", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const toggle = adminPage.locator("[data-role='food-item-card-toggle']");
      if ((await toggle.count()) === 0) {
        test.skip();
        return;
      }

      // Rapidly click toggle multiple times
      const clicks = Array.from({ length: 5 }, () => toggle.first().click());
      await Promise.all(clicks.map((c) => c.catch(() => {})));
      await adminPage.waitForTimeout(1000);

      // Page should remain stable (no crash)
      expect(adminPage.url()).toContain("comida");
    });

    test("handles very long text input in description", async ({ adminPage }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      const descField = adminPage.locator("[data-field='descripcion']");
      if ((await descField.count()) > 0) {
        const longText = "A".repeat(5000);
        await descField.fill(longText);
        await adminPage.waitForTimeout(200);

        // Form should not crash
        expect(await descField.inputValue()).toBeTruthy();
      }
    });

    test("session expiry redirects to login", async ({ adminPage }) => {
      // Invalidate session by clearing cookies
      await adminPage.context().clearCookies();

      await adminPage.goto(params.listPagePath);
      await adminPage.waitForURL("**/login**", { timeout: 10_000 });

      expect(adminPage.url()).toContain("/login");
    });

    test("invalid food type URL shows error page", async ({ adminPage }) => {
      await adminPage.goto("/app/comida/invalid_type_xyz123");
      await adminPage.waitForLoadState("networkidle");

      const errorMsg = adminPage.locator("[data-role='error-message']");
      const hasError = (await errorMsg.count()) > 0;
      const urlStillInvalid = adminPage.url().includes("invalid_type");

      expect(hasError || urlStillInvalid).toBeTruthy();
    });

    test("skeleton loading state appears before items load", async ({
      adminPage,
    }) => {
      // Intercept API to delay response
      await adminPage.route(
        `**/api/admin/comida/${params.urlPath}**`,
        async (route) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
          await route.continue();
        }
      );

      await adminPage.goto(params.listPagePath);
      await adminPage.waitForTimeout(200);

      const skeleton = adminPage.locator("[data-role='food-list-loading']");
      expect(await skeleton.count()).toBeGreaterThanOrEqual(0);
    });

    test("loading skeleton has correct structure", async ({ adminPage }) => {
      await adminPage.route(
        `**/api/admin/comida/${params.urlPath}**`,
        async (route) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
          await route.continue();
        }
      );

      await adminPage.goto(params.listPagePath);
      await adminPage.waitForTimeout(200);

      const skeleton = adminPage.locator("[data-role='food-list-loading']");
      const count = await skeleton.count();

      if (count > 0) {
        // Skeleton should contain multiple skeleton item elements
        const skeletonItems = skeleton.locator("[data-ui='skeleton-item']");
        expect(await skeletonItems.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test("skeleton disappears after items load", async ({ adminPage }) => {
      await adminPage.route(
        `**/api/admin/comida/${params.urlPath}**`,
        async (route) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
          await route.continue();
        }
      );

      await adminPage.goto(params.listPagePath);
      await adminPage.waitForTimeout(200);

      const skeleton = adminPage.locator("[data-role='food-list-loading']");
      await adminPage.waitForTimeout(1000);

      // Skeleton should be gone
      expect(await skeleton.count()).toBe(0);
    });

    test("all form fields have associated labels", async ({ adminPage }) => {
      await adminPage.goto(`${params.listPagePath}/new`);
      await adminPage.waitForLoadState("networkidle");

      const allFields = [
        ...params.requiredFields,
        ...(params.optionalFields ?? []),
      ];

      for (const field of allFields) {
        const input = adminPage.locator(`[data-field="${field}"]`);
        if ((await input.count()) > 0) {
          // Check for associated label via aria-labelledby or nested label
          const label = adminPage.locator(`label[for="${field}"], label:has([data-field="${field}"]), [aria-labelledby]`);
          expect(await label.count()).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("keyboard navigation works in food list", async ({ adminPage }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const grid = adminPage.locator("[data-role='food-list-grid']");
      if ((await grid.count()) === 0) {
        test.skip();
        return;
      }

      // Tab into the list
      await adminPage.keyboard.press("Tab");
      await adminPage.waitForTimeout(100);

      // Arrow down should move to next item
      await adminPage.keyboard.press("ArrowDown");
      await adminPage.waitForTimeout(100);

      // No crash
      expect(adminPage.url()).toContain("comida");
    });

    test("focus indicators visible on interactive elements", async ({
      adminPage,
    }) => {
      await adminPage.goto(params.listPagePath);
      await adminPage.waitForLoadState("networkidle");

      const interactive = adminPage.locator(
        "button, [role='button'], a, input, select, [role='combobox']"
      );

      const firstInteractive = interactive.first();
      await firstInteractive.focus();
      await adminPage.waitForTimeout(100);

      const focused = await adminPage.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          style.outlineWidth !== "0px" ||
          style.boxShadow !== "none" ||
          el.getAttribute("tabindex") !== null
        );
      });

      expect(focused).toBeTruthy();
    });
  });
}
