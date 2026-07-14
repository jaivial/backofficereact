import { test, expect } from "../../fixtures/session"
import { apiGet } from "../../helpers/api"

function todayStr(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

test.describe("Booking Create — full data flow", () => {
  const todayDate = todayStr()

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(`/app/reservas/anadir?date=${todayDate}`)
    await adminPage.waitForLoadState("networkidle")
  })

  test("creates non-group booking with arroz, salon, mesa and verifies success overlay", async ({ adminPage }) => {
    await adminPage.fill('[data-slot="booking-editor-client-input"]', "Cliente E2E Arroz")

    const phoneInput = adminPage.locator('[data-slot="booking-editor-phone-input"]')
    await phoneInput.fill("600111222")

    // Set Pax to 3
    const paxInput = adminPage.locator('[data-testid="booking-editor-counter-pax-input"]')
    await paxInput.fill("3")

    // Activate arroz panel
    const siArroz = adminPage.locator('[data-slot="booking-editor-arroz-yes"]')
    await siArroz.click()

    // Wait for arroz content to load
    await adminPage.waitForTimeout(500)

    // Select arroz type
    const arrozSelect = adminPage.locator('[data-slot="booking-editor-arroz-content"] [data-role="select-trigger"][aria-label="Tipo de arroz"]')
    await arrozSelect.click()
    await adminPage.waitForTimeout(200)
    // Pick first non-placeholder option
    const arrozOption = adminPage.locator('[data-ui="select-listbox"] [data-role="select-option"]').first()
    await arrozOption.click()

    // Fill table number
    const tableInput = adminPage.locator('[data-slot="booking-editor-table-input"]')
    await tableInput.fill("12")

    // Click Crear
    const crearBtn = adminPage.locator('[data-slot="booking-editor-submit"]')
    await expect(crearBtn).toBeEnabled()
    await crearBtn.click()

    // Loading overlay should appear
    const loadingOverlay = adminPage.locator('[data-slot="booking-create-loading-overlay"]')
    await expect(loadingOverlay).toBeVisible({ timeout: 5000 })

    // Wait for success overlay
    const successOverlay = adminPage.locator('[data-slot="booking-create-success-overlay"]')
    await expect(successOverlay).toBeVisible({ timeout: 15000 })

    // Verify success content
    await expect(adminPage.locator('[data-slot="booking-create-success-title"]')).toHaveText("Reserva creada")
    await expect(adminPage.locator('[data-slot="booking-create-success-name"]')).toHaveText("Cliente E2E Arroz")
    await expect(adminPage.locator('[data-slot="booking-create-success-extras"]')).toBeVisible()

    // Verify arroz is listed
    await expect(adminPage.locator('[data-slot="booking-create-success-rice"]').first()).toBeVisible()
  })

  test("creates group-menu booking with principales, salon and verifies success overlay", async ({ adminPage }) => {
    await adminPage.fill('[data-slot="booking-editor-client-input"]', "Cliente E2E Grupo")

    const phoneInput = adminPage.locator('[data-slot="booking-editor-phone-input"]')
    await phoneInput.fill("600333444")

    // Set Pax to 4
    const paxInput = adminPage.locator('[data-testid="booking-editor-counter-pax-input"]')
    await paxInput.fill("4")

    // Activate "Menú de grupo" panel
    const siMenuBtn = adminPage.locator('[data-slot="booking-editor-menu-yes"]')
    await siMenuBtn.click()

    // Wait for menus to load (spinner disappears)
    await adminPage.waitForTimeout(1500)

    // Select first available group menu
    const menuSelect = adminPage.locator('[data-slot="booking-editor-menu-select-field"] [data-role="select-trigger"]')
    await menuSelect.click()
    await adminPage.waitForTimeout(200)
    const menuOption = adminPage.locator('[data-ui="select-listbox"] [data-role="select-option"]').first()
    const menuLabel = await menuOption.textContent()
    await menuOption.click()

    // Wait for principales to appear
    await adminPage.waitForTimeout(500)

    // Select a principal
    const principalSelect = adminPage.locator('[data-slot="booking-editor-menu-principales"] [data-role="select-trigger"][aria-label="Principal"]')
    await principalSelect.click()
    await adminPage.waitForTimeout(200)
    const principalOption = adminPage.locator('[data-ui="select-listbox"] [data-role="select-option"]').first()
    await principalOption.click()

    // Fill table number
    const tableInput = adminPage.locator('[data-slot="booking-editor-table-input"]')
    await tableInput.fill("5")

    // Click Crear
    const crearBtn = adminPage.locator('[data-slot="booking-editor-submit"]')
    await expect(crearBtn).toBeEnabled({ timeout: 5000 })
    await crearBtn.click()

    // Loading overlay should appear
    const loadingOverlay = adminPage.locator('[data-slot="booking-create-loading-overlay"]')
    await expect(loadingOverlay).toBeVisible({ timeout: 5000 })

    // Wait for success overlay
    const successOverlay = adminPage.locator('[data-slot="booking-create-success-overlay"]')
    await expect(successOverlay).toBeVisible({ timeout: 15000 })

    // Verify success content
    await expect(adminPage.locator('[data-slot="booking-create-success-title"]')).toHaveText("Reserva creada")
    await expect(adminPage.locator('[data-slot="booking-create-success-name"]')).toHaveText("Cliente E2E Grupo")

    // Verify group menu is listed
    await expect(adminPage.locator('[data-slot="booking-create-success-group-menu"]')).toBeVisible()

    // Verify principales
    await expect(adminPage.locator('[data-slot="booking-create-success-principal"]').first()).toBeVisible()

    // Verify table
    await expect(adminPage.locator('[data-slot="booking-create-success-table"]')).toBeVisible()
  })

  test("submit button stays disabled until required fields are complete", async ({ adminPage }) => {
    const crearBtn = adminPage.locator('[data-slot="booking-editor-submit"]')
    await expect(crearBtn).toBeDisabled()

    // Required hint visible
    await expect(adminPage.locator('[data-slot="booking-editor-required-hint"]')).toBeVisible()

    await adminPage.fill('[data-slot="booking-editor-client-input"]', "Test")
    await expect(crearBtn).toBeDisabled()

    const phoneInput = adminPage.locator('[data-slot="booking-editor-phone-input"]')
    await phoneInput.fill("600000000")
    await expect(crearBtn).toBeEnabled()
  })
})
