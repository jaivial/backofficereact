import { test, expect, devices } from "../../fixtures/session";

const IPHONE_12 = devices["iPhone 12"];
const IPAD_PRO = devices["iPad Pro 11"];
const TEST_DATE = "2026-04-05";

// Skip: test.use() cannot be inside describe groups; needs Playwright project-level config
test.describe.skip("Tables Map - Mobile Touch Drag", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(`/app/reservas/tables?date=${TEST_DATE}`);
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });
  });

  test.describe("iPhone 12 - Touch Drag", () => {
    // test.use({ ...IPHONE_12 }); // requires top-level

    test("loads tables page on mobile", async ({ adminPage }) => {
      const flowWrapper = adminPage.locator('[data-ui="flow-wrapper"]');
      await expect(flowWrapper).toBeVisible({ timeout: 10000 });
    });

    test("displays table nodes on mobile", async ({ adminPage }) => {
      const tableNodes = adminPage.locator('[data-ui="table-node"]');
      const count = await tableNodes.count();
      expect(count).toBeGreaterThan(0);
    });

    test("can drag table via mouse emulation on mobile viewport", async ({ adminPage }) => {
      const tableNode = adminPage.locator('[data-ui="table-node"]').first();
      await expect(tableNode).toBeVisible();

      const box = await tableNode.boundingBox();
      expect(box).not.toBeNull();

      // Use mouse to emulate drag on mobile viewport
      await tableNode.hover();
      await adminPage.mouse.down();
      await adminPage.mouse.move(box!.x + 100, box!.y + 100, { steps: 10 });
      await adminPage.mouse.up();

      // Wait for position save API call
      await adminPage.waitForTimeout(1000);

      // No error toast should appear
      const errorToast = adminPage.locator('[data-toast-kind="error"]');
      await expect(errorToast).not.toBeVisible({ timeout: 2000 });
    });

    test("persists table position after reload on mobile", async ({ adminPage }) => {
      const tableNode = adminPage.locator('[data-ui="table-node"]').first();
      const initialBox = await tableNode.boundingBox();
      expect(initialBox).not.toBeNull();
      const initialX = initialBox!.x;
      const initialY = initialBox!.y;

      // Drag table
      await tableNode.hover();
      await adminPage.mouse.down();
      await adminPage.mouse.move(initialX + 150, initialY + 150, { steps: 15 });
      await adminPage.mouse.up();

      await adminPage.waitForTimeout(1200);

      // Reload page
      await adminPage.reload();
      await adminPage.waitForLoadState("networkidle");
      await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });

      const tableAfterReload = adminPage.locator('[data-ui="table-node"]').first();
      await expect(tableAfterReload).toBeVisible();
      const newBox = await tableAfterReload.boundingBox();
      expect(newBox).not.toBeNull();

      // Position should have changed significantly
      const moved = Math.abs(newBox!.x - initialX) > 50 || Math.abs(newBox!.y - initialY) > 50;
      expect(moved).toBe(true);
    });
  });

  test.describe("iPad Pro - Touch Drag", () => {
    // test.use({ ...IPAD_PRO }); // requires top-level

    test("loads tables page on tablet", async ({ adminPage }) => {
      const flowWrapper = adminPage.locator('[data-ui="flow-wrapper"]');
      await expect(flowWrapper).toBeVisible({ timeout: 10000 });
    });

    test("displays table nodes on tablet", async ({ adminPage }) => {
      const tableNodes = adminPage.locator('[data-ui="table-node"]');
      const count = await tableNodes.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});

test.describe("Tables Map - Desktop Drag (Regression)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(`/app/reservas/tables?date=${TEST_DATE}`);
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });
  });

  test("table drag saves position via onNodeDragStop", async ({ adminPage }) => {
    const tableNode = adminPage.locator('[data-ui="table-node"]').first();
    await expect(tableNode).toBeVisible();

    const box = await tableNode.boundingBox();
    expect(box).not.toBeNull();

    // Perform drag
    await tableNode.hover();
    await adminPage.mouse.down();
    await adminPage.mouse.move(box!.x + 80, box!.y + 80, { steps: 10 });
    await adminPage.mouse.up();

    // Wait for save
    await adminPage.waitForTimeout(1000);

    // No errors
    const errorToast = adminPage.locator('[data-toast-kind="error"]');
    await expect(errorToast).not.toBeVisible({ timeout: 2000 });
  });

  test("table position persists after page reload", async ({ adminPage }) => {
    const tableNode = adminPage.locator('[data-ui="table-node"]').first();
    const initialBox = await tableNode.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialX = initialBox!.x;
    const initialY = initialBox!.y;

    // Drag to new position
    await tableNode.hover();
    await adminPage.mouse.down();
    await adminPage.mouse.move(initialX + 120, initialY + 120, { steps: 12 });
    await adminPage.mouse.up();

    // Wait for save
    await adminPage.waitForTimeout(1500);

    // Reload
    await adminPage.reload();
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });

    // Verify position changed
    const tableAfterReload = adminPage.locator('[data-ui="table-node"]').first();
    await expect(tableAfterReload).toBeVisible();
    const newBox = await tableAfterReload.boundingBox();
    expect(newBox).not.toBeNull();

    const moved = Math.abs(newBox!.x - initialX) > 50 || Math.abs(newBox!.y - initialY) > 50;
    expect(moved).toBe(true);
  });

  test("multiple rapid drags are handled correctly", async ({ adminPage }) => {
    const tableNode = adminPage.locator('[data-ui="table-node"]').first();
    await expect(tableNode).toBeVisible();

    const box = await tableNode.boundingBox();
    expect(box).not.toBeNull();

    // Perform multiple drags
    for (let i = 0; i < 3; i++) {
      await tableNode.hover();
      await adminPage.mouse.down();
      await adminPage.mouse.move(box!.x + (i + 1) * 40, box!.y + (i + 1) * 40, { steps: 5 });
      await adminPage.mouse.up();
      await adminPage.waitForTimeout(200);
    }

    // Wait for debounce
    await adminPage.waitForTimeout(800);

    // No errors should appear
    const errorToast = adminPage.locator('[data-toast-kind="error"]');
    await expect(errorToast).not.toBeVisible({ timeout: 2000 });
  });
});

// Skip: test.use() cannot be inside describe groups; needs Playwright project-level config
test.describe.skip("Draw Elements - Mobile Touch", () => {
  // test.use({ ...IPHONE_12 }); // requires top-level

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(`/app/reservas/tables?date=${TEST_DATE}`);
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });

    // Enter draw mode
    const drawButton = adminPage.locator('[data-ui="toggle-draw-btn"]');
    if (await drawButton.isVisible()) {
      await drawButton.click();
      await adminPage.waitForTimeout(500);
    }
  });

  test("can add draw element in draw mode", async ({ adminPage }) => {
    const drawPanel = adminPage.locator('[data-ui="draw-panel"]');
    await expect(drawPanel).toBeVisible({ timeout: 5000 });

    const presetBtn = adminPage.locator('[data-ui="draw-preset-btn"]').first();
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
      await adminPage.waitForTimeout(500);
    }

    const drawElement = adminPage.locator('[data-ui="draw-element"]').first();
    await expect(drawElement).toBeVisible({ timeout: 5000 });
  });

  test("draw element positions persist after reload", async ({ adminPage }) => {
    // Add element if none
    const existingCount = await adminPage.locator('[data-ui="draw-element"]').count();
    if (existingCount === 0) {
      const presetBtn = adminPage.locator('[data-ui="draw-preset-btn"]').first();
      if (await presetBtn.isVisible()) {
        await presetBtn.click();
        await adminPage.waitForTimeout(500);
      }
    }

    // Drag element
    const element = adminPage.locator('[data-ui="draw-element"]').first();
    if (await element.isVisible()) {
      const box = await element.boundingBox();
      if (box) {
        await element.hover();
        await adminPage.mouse.down();
        await adminPage.mouse.move(box.x + 60, box.y + 60, { steps: 8 });
        await adminPage.mouse.up();
        await adminPage.waitForTimeout(800);
      }
    }

    // Reload and verify
    await adminPage.reload();
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForSelector('[data-ui="flow-wrapper"]', { timeout: 15000 });

    // Re-enter draw mode
    const drawButton = adminPage.locator('[data-ui="toggle-draw-btn"]');
    if (await drawButton.isVisible()) {
      await drawButton.click();
      await adminPage.waitForTimeout(500);
    }

    const elementAfterReload = adminPage.locator('[data-ui="draw-element"]').first();
    await expect(elementAfterReload).toBeVisible({ timeout: 5000 });
  });
});
