import { expect, test, type Page } from "../../fixtures/session";

const settings = { isEnabled: true, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00" };
const product = { id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true };
const line = { id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" };
const ticket = (overrides = {}) => ({ id: 11, ticketNumber: "TPV-1", version: 1, status: "OPEN", lines: [line], totalGrossCents: 250, ...overrides });
const visit = (overrides = {}) => ({ id: 10, channel: "DINE_IN", tableId: 7, tableName: "Mesa 1", covers: 2, status: "OPEN", ticket: ticket(), ...overrides });

async function openActiveRegister(page: Page) {
  await page.goto("/app/pos");
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pos-rail-mesa").click();
  await page.getByTestId("pos-table-7").click();
  await expect(page.getByTestId("pos-ticket-title")).toContainText("TPV-1");
}

test("POS: opens table, adds product and checks out once", async ({ adminPage: page }) => {
  let checkoutCalls = 0;
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings: { isEnabled: true, stockMode: "LIVE", coversMode: "LIVE", timezone: "Europe/Madrid", businessDayCutoff: "05:00" }, products: [{ id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true }], visits: [], tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: false }] } });
    if (url.endsWith("/visits") && method === "POST") return route.fulfill({ status: 201, json: { success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, ticketNumber: "TPV-1", version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } } });
    if (url.endsWith("/tickets/11/lines") && method === "POST") return route.fulfill({ status: 201, json: { success: true, ticket: { id: 11, ticketNumber: "TPV-1", version: 2, status: "OPEN", lines: [{ id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 } } });
    if (url.endsWith("/tickets/11/checkout") && method === "POST") { checkoutCalls += 1; return route.fulfill({ json: { success: true, ticket: { id: 11, ticketNumber: "TPV-1", version: 3, status: "PAID", lines: [], totalGrossCents: 250 }, stockStatus: "COMPLETE", visitClosed: true } }); }
    return route.fulfill({ json: { success: true, items: [], products: [] } });
  });
  await page.goto("/app/pos");
  // Category tile appears only after client-side bootstrap => hydration done.
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pos-rail-mesa").click();
  await page.getByTestId("pos-table-7").click();
  await page.getByTestId("pos-covers-input").fill("2");
  await page.getByTestId("pos-open-visit").click();
  await page.getByTestId("pos-product-3").click();
  await expect(page.getByTestId("pos-total-value")).toHaveText(/2,50/);
  await page.getByTestId("pos-rail-total").click();
  await page.getByTestId("pos-cash").fill("2.50");
  await page.getByTestId("pos-checkout-confirm").click();
  await expect(page.getByTestId("pos-last-receipt")).toBeVisible();
  expect(checkoutCalls).toBe(1);
});

test("POS: fullscreen mode hides sidebar and topbar", async ({ adminPage: page }) => {
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings: { isEnabled: true, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00" }, products: [{ id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true }], visits: [], tables: [] } });
    return route.fulfill({ json: { success: true, items: [], products: [] } });
  });
  await page.goto("/app/pos");
  await expect(page.getByTestId("topbar")).toBeVisible();
  // Category tile appears only after client-side bootstrap => hydration done.
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pos-section-menu").click();
  await page.getByTestId("pos-view-fullscreen").click();
  await expect(page.getByTestId("topbar")).toHaveCount(0);
  await expect(page.getByTestId("sidebar-nav-mobile")).toHaveCount(0);
  await page.getByTestId("pos-section-menu").click();
  await page.getByTestId("pos-view-integrated").click();
  await expect(page.getByTestId("topbar")).toBeVisible();
});

test("POS buttons: parks with note, recovers through explicit unpark, and filters areas with reset", async ({ adminPage: page }) => {
  const bodies: Array<{ url: string; body: Record<string, unknown> }> = [];
  let parked = false;
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const body = route.request().postDataJSON?.() || {};
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, products: [product], areas: [{ id: 1, name: "Terraza" }, { id: 2, name: "Interior" }], tables: [{ id: 7, name: "Mesa 1", capacity: 4, areaId: 1, occupied: !parked }, { id: 8, name: "Mesa 2", capacity: 4, areaId: 2, occupied: false }], visits: parked ? [visit({ parked: true, parkedNote: "Esperando postre", totalGrossCents: 250 })] : [visit()] } });
    if (url.endsWith("/visits/10/park") && method === "POST") { bodies.push({ url, body }); parked = Boolean(body.parked); return route.fulfill({ json: { success: true } }); }
    if (url.endsWith("/visits/10")) return route.fulfill({ json: { success: true, visit: { ...visit({ parked: false }), tickets: [ticket()] } } });
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await openActiveRegister(page);
  await page.getByTestId("pos-rail-aparcar").click();
  await page.getByTestId("pos-park-note").fill("Esperando postre");
  await page.getByTestId("pos-park-confirm").click();
  await page.getByTestId("pos-rail-mesa").click();
  await expect(page.getByTestId("pos-parked-10")).toContainText("Esperando postre");
  await page.getByTestId("pos-parked-10").click();
  expect(bodies.map((entry) => entry.body)).toEqual([{ parked: true, note: "Esperando postre" }, { parked: false, note: "" }]);
  await page.getByTestId("pos-rail-salon").click();
  await page.getByTestId("pos-area-1").click();
  await expect(page.getByTestId("pos-table-7")).toBeVisible();
  await expect(page.getByTestId("pos-table-8")).toHaveCount(0);
  await page.getByTestId("pos-tables-close").click();
  await page.getByTestId("pos-rail-salon").click();
  await expect(page.getByTestId("pos-area-all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pos-table-8")).toBeVisible();
});

test("POS buttons: merges multiple visits and refreshes source occupancy", async ({ adminPage: page }) => {
  let merged = false;
  let mergeBody: Record<string, unknown> = {};
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, products: [product], tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: true }, { id: 8, name: "Mesa 2", capacity: 4, occupied: !merged }, { id: 9, name: "Mesa 3", capacity: 4, occupied: !merged }], visits: [visit(), ...(!merged ? [visit({ id: 20, tableId: 8, tableName: "Mesa 2" }), visit({ id: 30, tableId: 9, tableName: "Mesa 3" })] : [])] } });
    if (url.endsWith("/visits/10/merge")) { mergeBody = route.request().postDataJSON(); merged = true; return route.fulfill({ json: { success: true, ticket: ticket({ version: 2 }), covers: 6 } }); }
    if (url.endsWith("/visits/10")) return route.fulfill({ json: { success: true, visit: { ...visit(), tickets: [ticket()] } } });
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await openActiveRegister(page);
  await page.getByTestId("pos-rail-juntar-mesas").click();
  await page.getByTestId("pos-merge-checkbox-20").check();
  await page.getByTestId("pos-merge-checkbox-30").check();
  await expect(page.getByTestId("pos-merge-summary")).toContainText("2 seleccionada(s)");
  await page.getByTestId("pos-merge-confirm").click();
  expect(mergeBody).toMatchObject({ sourceVisitIds: [20, 30], expectedVersion: 1 });
  await page.getByTestId("pos-rail-mesa").click();
  await expect(page.getByTestId("pos-table-state-8")).toHaveText("4 plazas");
  await expect(page.getByTestId("pos-table-state-9")).toHaveText("4 plazas");
});

test("POS buttons: persists customer, operator, tags, and comment visuals", async ({ adminPage: page }) => {
  let currentTicket: Record<string, any> = ticket();
  let currentVisit: Record<string, any> = visit();
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON?.() || {};
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, products: [product], tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: true }], visits: [currentVisit], operators: [{ id: 3, displayName: "Ana" }] } });
    if (url.endsWith("/visits/10")) return route.fulfill({ json: { success: true, visit: { ...currentVisit, tickets: [currentTicket] } } });
    if (url.endsWith("/customer")) { currentVisit = { ...currentVisit, customerName: body.customerName, customerTaxId: body.customerTaxId }; return route.fulfill({ json: { success: true, visit: currentVisit } }); }
    if (url.endsWith("/operator")) { currentTicket = { ...currentTicket, operatorMemberId: body.operatorMemberId }; return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    if (url.endsWith("/tags") && route.request().method() === "GET") return route.fulfill({ json: { success: true, items: [{ id: 2, name: "Sin hielo", isActive: true }] } });
    if (url.endsWith("/lines/12/tags")) { currentTicket = { ...currentTicket, lines: [{ ...line, tagIds: [2] }] }; return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    if (url.endsWith("/lines/12")) { currentTicket = { ...currentTicket, version: 2, lines: [{ ...line, notes: body.notes }] }; return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await openActiveRegister(page);
  await page.getByTestId("pos-line-12").click();
  await page.getByTestId("pos-rail-cliente").click();
  await page.getByTestId("pos-customer-customerName").fill("Ana Ruiz");
  await page.getByTestId("pos-customer-customerTaxId").fill("12345678z");
  await page.getByTestId("pos-customer-confirm").click();
  await expect(page.getByTestId("pos-ticket-customer")).toContainText("Ana Ruiz · 12345678Z");
  await page.getByTestId("pos-rail-empleado").click();
  await page.getByTestId("pos-operator-operatorMemberId").selectOption("3");
  await page.getByTestId("pos-operator-confirm").click();
  await expect(page.getByTestId("pos-ticket-operator")).toContainText("Ana");
  await page.getByTestId("pos-rail-tags").click();
  await page.getByTestId("pos-tags-checkbox-2").check();
  await page.getByTestId("pos-tags-confirm").click();
  await expect(page.getByTestId("pos-line-tags-12")).toContainText("Sin hielo");
  await page.getByTestId("pos-rail-comentario").click();
  await page.getByTestId("pos-note-note").fill("Muy fría");
  await page.getByTestId("pos-note-confirm").click();
  await expect(page.getByTestId("pos-line-note-12")).toHaveText("Muy fría");
});

test("POS buttons: gates drawer by shift and deduplicates double click", async ({ adminPage: page }) => {
  let drawerCalls = 0;
  let shiftOpen = false;
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings: { ...settings, requireOpenShift: true }, currentShift: shiftOpen ? { id: 4, status: "OPEN" } : null, products: [product], tables: [], visits: [] } });
    if (url.endsWith("/drawer/open")) { drawerCalls += 1; await new Promise((resolve) => setTimeout(resolve, 100)); return route.fulfill({ json: { success: true } }); }
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await page.goto("/app/pos");
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pos-rail-cajon")).toBeDisabled();
  expect(drawerCalls).toBe(0);
  shiftOpen = true;
  await page.reload();
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pos-rail-cajon").click();
  await page.getByTestId("pos-drawer-confirm").dblclick();
  await expect.poll(() => drawerCalls).toBe(1);
});

test("POS buttons: keeps surcharge and discount, then comps visible ACTIVE line and closes zero total", async ({ adminPage: page }) => {
  let currentTicket = ticket();
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON?.() || {};
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, products: [product], tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: true }], visits: [visit()] } });
    if (url.endsWith("/visits/10")) return route.fulfill({ json: { success: true, visit: { ...visit(), tickets: [currentTicket] } } });
    if (url.endsWith("/adjustments")) { requests.push({ path: "adjustment", body }); currentTicket = ticket({ version: 2, surchargeCents: 50, totalGrossCents: 300 }); return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    if (url.endsWith("/discount")) { requests.push({ path: "discount", body }); currentTicket = ticket({ version: 3, surchargeCents: 50, discountCents: 100, totalGrossCents: 200 }); return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    if (url.endsWith("/comp")) { requests.push({ path: "comp", body }); currentTicket = ticket({ version: 4, surchargeCents: 50, discountCents: 100, lines: [{ ...line, comped: true, compReason: "Casa", lineTotalGrossCents: 0, status: "ACTIVE" }], totalGrossCents: 0 }); return route.fulfill({ json: { success: true, ticket: currentTicket } }); }
    if (url.endsWith("/checkout")) { requests.push({ path: "checkout", body }); return route.fulfill({ json: { success: true, ticket: ticket({ status: "PAID", totalGrossCents: 0 }), visitClosed: true } }); }
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await openActiveRegister(page);
  await page.getByTestId("pos-line-12").click();
  await page.getByTestId("pos-rail-recargo").click();
  await page.getByTestId("pos-surcharge-value").fill("0.50");
  await page.getByTestId("pos-surcharge-reason").fill("Terraza");
  await page.getByTestId("pos-surcharge-confirm").click();
  await page.getByTestId("pos-rail-descuento").click();
  await page.getByTestId("pos-discount-amount").fill("1");
  await page.getByTestId("pos-discount-reason").fill("Fidelidad");
  await expect(page.getByTestId("pos-discount-preview")).toContainText("Total 2,00");
  await page.getByTestId("pos-discount-confirm").click();
  await expect(page.getByTestId("pos-ticket-surcharge")).toContainText("0,50");
  await expect(page.getByTestId("pos-ticket-discount")).toContainText("1,00");
  expect(requests.slice(0, 2).map((entry) => entry.body)).toEqual([
    expect.objectContaining({ type: "SURCHARGE", mode: "AMOUNT", amountCents: 50, reason: "Terraza" }),
    { amountCents: 100, reason: "Fidelidad" },
  ]);
  await page.getByTestId("pos-rail-invita").click();
  await page.getByTestId("pos-comp-reason").fill("Casa");
  await page.getByTestId("pos-comp-confirm").click();
  await expect(page.getByTestId("pos-line-12")).toBeVisible();
  await expect(page.getByTestId("pos-line-comp-12")).toContainText("Casa");
  await expect(page.getByTestId("pos-total-value")).toContainText("0,00");
  await page.getByTestId("pos-rail-total").click();
  await expect(page.getByTestId("pos-checkout-confirm")).toBeEnabled();
  await page.getByTestId("pos-checkout-confirm").click();
  expect(requests.find((entry) => entry.path === "checkout")?.body).toMatchObject({ payments: [] });
});

test("POS: comanda downloads the order summary without touching the ticket", async ({ adminPage: page }) => {
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, restaurant: { name: "Villa Carmen", taxId: "B12345678", address: "Calle Mayor 1", phone: "+34600000000", logoUrl: "" }, products: [product], tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: true }], visits: [visit()] } });
    if (url.endsWith("/visits/10")) return route.fulfill({ json: { success: true, visit: { ...visit(), tickets: [ticket()] } } });
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await page.goto("/app/pos");
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pos-rail-comanda")).toBeDisabled();
  await page.getByTestId("pos-rail-mesa").click();
  await page.getByTestId("pos-table-7").click();
  await expect(page.getByTestId("pos-ticket-title")).toContainText("TPV-1");
  await expect(page.getByTestId("pos-rail-comanda")).toBeEnabled();

  const download = await Promise.all([page.waitForEvent("download"), page.getByTestId("pos-rail-comanda").click()]).then(([entry]) => entry);
  expect(download.suggestedFilename()).toBe("comanda-TPV-1.pdf");
  const stream = await download.createReadStream();
  const size = await new Promise<number>((resolve, reject) => { let total = 0; stream.on("data", (chunk) => { total += chunk.length; }); stream.on("end", () => resolve(total)); stream.on("error", reject); });
  expect(size).toBeGreaterThan(0);
  await expect(page.getByTestId("pos-line-12")).toBeVisible();
  await expect(page.getByTestId("pos-total-value")).toContainText("2,50");
});

test("POS buttons: opens BAR once, protects active register, and charges sale plus tip", async ({ adminPage: page }) => {
  let active = false;
  let visitCalls = 0;
  let checkoutBody: Record<string, unknown> = {};
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const body = route.request().postDataJSON?.() || {};
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: { success: true, settings, products: [product], tables: [], visits: [] } });
    if (url.endsWith("/visits") && method === "POST") { visitCalls += 1; active = true; return route.fulfill({ json: { success: true, visit: visit({ channel: "BAR", tableId: null, tableName: undefined, covers: 0 }), ticket: ticket() } }); }
    if (url.endsWith("/checkout")) { checkoutBody = body; return route.fulfill({ json: { success: true, ticket: ticket({ status: "PAID" }), visitClosed: true } }); }
    return route.fulfill({ json: { success: true, items: [] } });
  });
  await page.goto("/app/pos");
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pos-rail-barra").dblclick();
  await expect(page.getByTestId("pos-ticket-channel")).toHaveText("Barra");
  await expect(page.getByTestId("pos-rail-barra")).toBeDisabled();
  expect(active).toBe(true);
  expect(visitCalls).toBe(1);
  await page.getByTestId("pos-rail-propina").click();
  await page.getByTestId("pos-tip-value").fill("1");
  await expect(page.getByTestId("pos-tip-summary")).toContainText("3,50");
  await page.getByTestId("pos-tip-confirm").click();
  await expect(page.getByTestId("pos-checkout-sale")).toContainText("2,50");
  await expect(page.getByTestId("pos-checkout-tip")).toContainText("1,00");
  await expect(page.getByTestId("pos-checkout-due")).toContainText("3,50");
  await page.getByTestId("pos-cash").fill("3.50");
  await page.getByTestId("pos-checkout-confirm").click();
  expect(checkoutBody).toMatchObject({ payments: [{ method: "CASH", amountCents: 250, tipCents: 100 }] });
});
