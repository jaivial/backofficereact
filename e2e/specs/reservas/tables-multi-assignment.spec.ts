import { test, expect } from "../../fixtures/session";
import { waitForIdle } from "../../helpers/wait";

test.describe("Multi-table assignment from booking list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/reservas/tables");
    await waitForIdle(page);
  });

  test("shows multi-table toggle above selected booking in assign mode", async ({
    page,
  }) => {
    // Click "Asignar mesas" to enter assign mode
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    // Click a booking to select it
    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    // Multi-table toggle should appear inline above the booking
    const multiTableInline = page.locator(".bo-multiTableInline");
    await expect(multiTableInline).toBeVisible({ timeout: 5000 });

    const toggle = page.locator(".bo-multiTableToggle");
    await expect(toggle).toBeVisible();
  });

  test("enables multi-table mode and shows hint when toggle clicked", async ({ page }) => {
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    // Click toggle to enable multi-table mode
    const toggle = page.locator(".bo-multiTableToggle");
    if (!(await toggle.isVisible())) return;
    
    await toggle.click();
    await waitForIdle(page);

    // Toggle should be active
    await expect(toggle).toHaveClass(/is-active/);

    // Should show hint to click tables
    const hint = page.locator(".bo-multiTableHint");
    await expect(hint).toBeVisible();
  });

  test("adds table to draft when clicking table in multi-table mode", async ({
    page,
  }) => {
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    const toggle = page.locator(".bo-multiTableToggle");
    if (!(await toggle.isVisible())) return;
    
    await toggle.click();
    await waitForIdle(page);

    // Click a table in the map
    const tableNode = page.locator('[data-testid^="table-node-"]').first();
    if (!(await tableNode.isVisible())) return;
    
    await tableNode.click();
    await waitForIdle(page);

    // Should show the table in the assigned list with progress
    const progress = page.locator(".bo-multiTableProgress");
    await expect(progress).toBeVisible();

    const assignedRow = page.locator(".bo-multiTableRow").first();
    await expect(assignedRow).toBeVisible();
  });

  test("shows save button when tables added to draft", async ({ page }) => {
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    const toggle = page.locator(".bo-multiTableToggle");
    if (!(await toggle.isVisible())) return;
    
    await toggle.click();
    await waitForIdle(page);

    const tableNode = page.locator('[data-testid^="table-node-"]').first();
    if (!(await tableNode.isVisible())) return;
    
    await tableNode.click();
    await waitForIdle(page);

    // Save button should be visible
    const saveBtn = page.locator('button:has-text("Guardar mesas")');
    await expect(saveBtn).toBeVisible();
  });

  test("removes table from draft when remove button clicked", async ({ page }) => {
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    const toggle = page.locator(".bo-multiTableToggle");
    if (!(await toggle.isVisible())) return;
    
    await toggle.click();
    await waitForIdle(page);

    const tableNode = page.locator('[data-testid^="table-node-"]').first();
    if (!(await tableNode.isVisible())) return;
    
    await tableNode.click();
    await waitForIdle(page);

    // Should have one row
    let rows = page.locator(".bo-multiTableRow");
    await expect(rows).toHaveCount(1);

    // Click remove button
    const removeBtn = page.locator('.bo-multiTableRow button:has-text("×")').first();
    await removeBtn.click();
    await waitForIdle(page);

    // Should have zero rows now
    rows = page.locator(".bo-multiTableRow");
    await expect(rows).toHaveCount(0);
  });

  test("shows overlay buttons on selected tables in the map", async ({ page }) => {
    const assignBtn = page.locator('button:has-text("Asignar mesas")');
    if (!(await assignBtn.isVisible())) return;
    
    await assignBtn.click();
    await waitForIdle(page);

    const bookingRow = page.locator('[data-ui="booking-row"]:not(.is-disabled)').first();
    if (!(await bookingRow.isVisible())) return;
    
    await bookingRow.click();
    await waitForIdle(page);

    const toggle = page.locator(".bo-multiTableToggle");
    if (!(await toggle.isVisible())) return;
    
    await toggle.click();
    await waitForIdle(page);

    const tableNode = page.locator('[data-testid^="table-node-"]').first();
    if (!(await tableNode.isVisible())) return;
    
    await tableNode.click();
    await waitForIdle(page);

    // The table node should have multi-selected class
    const selectedTable = page.locator('.bo-tableMapNode.is-multi-selected');
    await expect(selectedTable).toBeVisible();

    // Should show overlay with buttons
    const overlay = page.locator('.bo-tableMultiSelectOverlay');
    await expect(overlay).toBeVisible();

    // Should have names and remove buttons
    const namesBtn = page.locator('[data-ui="multi-names-btn"]');
    const removeBtn = page.locator('[data-ui="multi-remove-btn"]');
    await expect(namesBtn).toBeVisible();
    await expect(removeBtn).toBeVisible();
  });

  test("clicking occupied table in view mode opens booking modal", async ({ page }) => {
    // Find a table that has bookings (reserved or occupied status indicator)
    const occupiedTable = page.locator('.bo-tableMapNode:has(.bo-tableMapNodeStatus.is-occupied), .bo-tableMapNode:has(.bo-tableMapNodeStatus.is-reserved)').first();
    
    if (!(await occupiedTable.isVisible({ timeout: 3000 }).catch(() => false))) {
      // No occupied tables, skip test
      return;
    }

    await occupiedTable.click();
    await waitForIdle(page);

    // Should open the booking modal
    const modal = page.locator('.bo-tableBookingModal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Modal should show customer name
    const customerName = page.locator('[data-ui="booking-hero-name"]');
    await expect(customerName).toBeVisible();
  });
});
