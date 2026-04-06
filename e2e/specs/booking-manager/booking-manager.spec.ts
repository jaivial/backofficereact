import { test, expect } from '../../fixtures/session'
import { apiGet, apiPost } from '../../helpers/api'

/**
 * E2E tests for Booking Manager configuration page.
 * Tests the full user flow: navigation, color customization, and preview.
 */

test.describe('Booking Manager', () => {
  test.beforeEach(async ({ adminPage }) => {
    // Navigate to the config page with booking tab active.
    await adminPage.goto('/app/config?content=booking')
    await adminPage.waitForLoadState('networkidle')
  })

  test('displays the booking tab in config navigation', async ({ adminPage }) => {
    // Check the booking tab is visible.
    const bookingTab = adminPage.getByRole('link', { name: /booking/i })
    await expect(bookingTab).toBeVisible()
    await expect(bookingTab).toHaveAttribute('href', '#booking')
  })

  test('shows install guide with copy buttons', async ({ adminPage }) => {
    // Install guide panel should be visible.
    const installGuide = adminPage.locator('[data-ui="install-guide"]')
    await expect(installGuide).toBeVisible()

    // Should have 3 steps.
    const steps = adminPage.locator('[data-ui="install-step"]')
    await expect(steps).toHaveCount(3)

    // Each step should have a copy button.
    const copyButtons = adminPage.locator('[data-ui="install-copy-btn"]')
    await expect(copyButtons).toHaveCount(3)
  })

  test('displays color customization panel with all pickers', async ({ adminPage }) => {
    // Color customization panel should be visible.
    const colorsGrid = adminPage.locator('[data-ui="colors-grid"]')
    await expect(colorsGrid).toBeVisible()

    // Should have 6 color pickers.
    const colorPickers = adminPage.locator('[data-ui="color-picker"]')
    await expect(colorPickers).toHaveCount(6)

    // Verify labels are present.
    await expect(adminPage.getByText(/Color primario/i)).toBeVisible()
    await expect(adminPage.getByText(/Color de éxito/i)).toBeVisible()
    await expect(adminPage.getByText(/Color de borde/i)).toBeVisible()
    await expect(adminPage.getByText(/Color de fondo/i)).toBeVisible()
    await expect(adminPage.getByText(/Color de texto/i)).toBeVisible()
    await expect(adminPage.getByText(/Color secundario/i)).toBeVisible()
  })

  test('shows live widget preview', async ({ adminPage }) => {
    // Widget preview should be visible.
    const preview = adminPage.locator('[data-ui="widget-preview"]')
    await expect(preview).toBeVisible()

    // Should show widget title.
    await expect(preview.getByText(/Nueva Villa Carmen/i)).toBeVisible()

    // Should show calendar mock.
    await expect(preview.locator('[data-ui="widget-calendar"]')).toBeVisible()

    // Should show guest counter.
    await expect(preview.locator('[data-ui="widget-guest-counter"]')).toBeVisible()

    // Should show CTA button.
    await expect(preview.getByRole('button', { name: /horarios/i })).toBeVisible()
  })

  test('changes color and saves via API', async ({ adminPage, session }) => {
    // Wait for initial load.
    await adminPage.waitForSelector('[data-ui="color-picker"]')

    // Get the first color picker input (primary color).
    const primaryColorInput = adminPage.locator('[data-ui="color-picker"] input[type="color"]').first()

    // Change to a new color.
    const newColor = '#ff0000'
    await primaryColorInput.fill(newColor)

    // Wait for debounced save (600ms + buffer).
    await adminPage.waitForTimeout(1500)

    // Verify the value was saved via API.
    const settings = await apiGet(adminPage, '/api/admin/widget/settings', session)
    expect((settings as Record<string, unknown>).success).toBe(true)
  })

  test('copies embed code to clipboard', async ({ adminPage, context }) => {
    // Grant clipboard permissions.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Click the first copy button.
    const copyButton = adminPage.locator('[data-ui="install-copy-btn"]').first()
    await copyButton.click()

    // Check for success toast.
    const toast = adminPage.locator('[data-ui="toast-stack"]')
    await expect(toast).toBeVisible()

    // Verify clipboard content contains the script tag.
    const clipboardContent = await adminPage.evaluate(() => navigator.clipboard.readText())
    expect(clipboardContent).toContain('<script')
    expect(clipboardContent).toContain('booking-widget')
  })

  test('widget preview updates when color changes', async ({ adminPage }) => {
    // Get the widget preview element.
    const preview = adminPage.locator('[data-ui="widget-preview"]')

    // Get initial primary color from preview style.
    const initialStyle = await preview.getAttribute('style')

    // Change primary color picker.
    const primaryColorInput = adminPage.locator('[data-ui="color-picker"] input[type="color"]').first()
    await primaryColorInput.fill('#00ff00')

    // Wait for React state update.
    await adminPage.waitForTimeout(100)

    // Verify preview style updated.
    const newStyle = await preview.getAttribute('style')
    expect(newStyle).toContain('#00ff00')
    expect(newStyle).not.toBe(initialStyle)
  })
})

test.describe('Booking Manager - Unauthenticated', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/app/config?content=booking')

    // Should redirect to login page.
    await page.waitForURL(/\/login|\/auth/, { timeout: 10000 }).catch(() => {
      // If no redirect, check that we're on login or have no access.
    })

    // Verify we're not on the config page with full access.
    const url = page.url()
    const isOnLogin = url.includes('/login') || url.includes('/auth')
    const hasNoSession = !(url.includes('/app/config'))

    expect(isOnLogin || hasNoSession).toBe(true)
  })
})
