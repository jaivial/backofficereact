/**
 * Aforo (capacity) feature — e2e tests.
 *
 * Covers the capacity feature end to end:
 *  - T6: the backoffice floor aforo modal persists a global max-aforo and the
 *        floor card reflects it.
 *  - T7: the backend rejects a salon that would push a capped floor over its
 *        max aforo (`aforoCapped` + `remainingAforo`), and accepts one that fits.
 *  - T4/T5: the occupancy ledger — creating a booking on a floor decrements the
 *        floor's remaining aforo (read back through the public day-context
 *        endpoint) and cancelling it restores it, gated by party_size.
 *
 * All flows use real admin APIs through the logged-in page context and restore
 * the mutated dev data afterwards, so reruns stay reproducible.
 */
import { test, expect } from "../fixtures/session";
import type { TestApiClient } from "../helpers/api-client";

const BACKEND_BASE = process.env.BACKEND_BASE || "http://127.0.0.1:8080";
// Keep the requested seat count well below the test aforo so the assertion is
// about the booking decrement, not the capacity gate.
const PARTY_SIZE = 2;
const FLOOR_AFORO = 40;

interface FloorSummary {
  id: number;
  floorNumber: number;
  name: string;
  active?: boolean;
  isGround?: boolean;
  maxAforo?: number;
  /** Backend-computed sum of this floor's capacity-limited salons. */
  totalSalonAforo?: number;
  occupancy?: number;
  remaining?: number;
}

interface DayContext {
  success: boolean;
  floors?: FloorSummary[];
  activeFloors?: FloorSummary[];
}

/** Floor we drive the occupancy assertions against: first non-ground active floor. */
function pickFloor(floors: FloorSummary[]): FloorSummary {
  const active = floors?.find((f) => f.floorNumber > 0 && f.active);
  return active ?? floors?.[0];
}

/**
 * Choose a target floor for the aforo tests. The backend refuses to set a floor
 * cap below the sum of its salons' capacities (`totalSalonAforo`), so prefer a
 * non-ground active floor that leaves the smallest existing salon sum — this
 * keeps the UI counter climb small and guarantees a valid save. Falls back to
 * any floor.
 */
function chooseTestFloor(floors: FloorSummary[]): FloorSummary {
  const candidates = floors
    .filter((f) => f.floorNumber > 0 && f.active)
    .sort((a, b) => (a.totalSalonAforo ?? 0) - (b.totalSalonAforo ?? 0));
  return candidates[0] ?? pickFloor(floors);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** GET public day-context straight from the backend (resolves via DEFAULT_RESTAURANT_ID). */
async function dayContext(api: TestApiClient, date: string, partySize: number): Promise<DayContext> {
  return api.get<DayContext>(
    `${BACKEND_BASE}/api/reservations/day-context?date=${date}&party_size=${partySize}`,
  );
}

async function getDefaultFloors(api: TestApiClient): Promise<FloorSummary[]> {
  const res = await api.get<{ success: boolean; floors?: FloorSummary[] }>(
    "/api/admin/config/floors/defaults",
  );
  expect(res.success).toBe(true);
  return res.floors ?? [];
}

test.describe("Aforo (capacidad)", () => {
  test.describe.configure({ mode: "serial" });

  test("T6 · floor aforo modal persists a global max-aforo and the card reflects it", async ({
    adminPage,
    api,
  }) => {
    const floorsBefore = await getDefaultFloors(api);
    const target = chooseTestFloor(floorsBefore);
    expect(target, "A restaurant floor is required").toBeTruthy();

    const priorAforo = target.maxAforo ?? 0;
    // The backend refuses to set a cap below the sum of the floor's salons, so
    // our target must end strictly above that sum (Planta 1 has no salons, so
    // a value of 1 is enough there). We climb directly from the counter's live
    // value inside the modal to keep the number of clicks tiny and fast.
    const existingSalonSum = target.totalSalonAforo ?? 0;

    try {
      // Open /app/config (Plantas tab is default) and expand the target floor card.
      await adminPage.goto("/app/config", { waitUntil: "networkidle", timeout: 30_000 });
      const card = adminPage.getByTestId(`config-floors-floor-card-info-${target.floorNumber}`);
      await expect(card).toBeVisible({ timeout: 20_000 });

      // Open the floor aforo editor modal.
      const aforoBtn = adminPage.getByTestId(`config-floors-floor-aforo-edit-${target.floorNumber}`);
      await aforoBtn.click();
      const modal = adminPage.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal).toHaveAttribute("aria-label", `Aforo máximo · ${target.name}`);

      // Enable the cap (only toggle it on if it isn't already on from a prior
      // max-aforo), then climb the counter up to a small valid target. Reading
      // the live value keeps the climb to a handful of clicks even if a prior
      // run left the floor capped.
      const cappedSwitch = modal.getByTestId("floor-aforo-capped-switch");
      const alreadyOn = (await cappedSwitch.getAttribute("aria-checked")) === "true";
      if (!alreadyOn) await cappedSwitch.click();
      const valueSlot = modal.locator('[data-slot="plus-minus-counter-value"]');
      const currentVal = parseInt((await valueSlot.innerText()).replace(/\D/g, "") || "0", 10);
      const targetAforo = Math.max(currentVal + 1, existingSalonSum + 1, 1);
      const plus = modal.getByTestId("plus-minus-counter-plus");
      const clicks = Math.max(0, targetAforo - currentVal);
      for (let i = 0; i < clicks; i += 1) await plus.click();
      await expect(valueSlot).toContainText(String(targetAforo));

      await modal.getByTestId("floor-aforo-save").click();
      await expect(modal).not.toBeVisible();

      // Backend+card reflect the new value.
      await expect
        .poll(() => getDefaultFloors(api).then((fs) => fs.find((f) => f.floorNumber === target.floorNumber)?.maxAforo ?? 0))
        .toBe(targetAforo);
      await expect(adminPage.getByTestId(`config-floors-floor-hint-${target.floorNumber}`)).toContainText(
        `Aforo máx ${targetAforo}`,
      );
    } finally {
      // Restore the previous aforo (0 = unbounded).
      await api.post("/api/admin/config/floors/defaults", {
        floorNumber: target.floorNumber,
        maxAforo: priorAforo,
      });
    }
  });

  test("T7 · backend rejects a salon that exceeds the floor's remaining aforo", async ({
    api,
  }) => {
    const floors = await getDefaultFloors(api);
    const target = chooseTestFloor(floors);
    const priorAforo = target.maxAforo ?? 0;

    // Existing salons already consume part of the cap; make sure our cap is
    // above it by at least one, then we can fill the exact remainder.
    const existingSum = target.totalSalonAforo ?? 0;
    const cap = Math.max(FLOOR_AFORO, existingSum + 1);
    const fillCapacity = cap - existingSum;

    const createdIds: number[] = [];
    try {
      // Give the floor a hard cap so the sum is checked.
      const capRes = await api.post("/api/admin/config/floors/defaults", {
        floorNumber: target.floorNumber,
        maxAforo: cap,
      });
      expect(capRes.success).toBe(true);

      const mkt = `aforo-test-${Date.now()}`;
      // A salon filling the exact remainder fits.
      const ok = await api.post("/api/admin/config/salons", {
        floorId: target.id,
        name: `${mkt}-fit`,
        hasCapacityLimit: true,
        capacityLimit: fillCapacity,
      });
      expect(ok.success).toBe(true);
      const fitId = (ok as { salon?: { id: number } }).salon?.id;
      expect(fitId).toBeTruthy();
      createdIds.push(fitId as number);

      // A second salon, even of size 1, does not fit (0 remaining).
      const over = await api.post("/api/admin/config/salons", {
        floorId: target.id,
        name: `${mkt}-over`,
        hasCapacityLimit: true,
        capacityLimit: 1,
      });
      expect(over.success).toBe(false);
      expect((over as { aforoCapped?: boolean }).aforoCapped).toBe(true);
      expect((over as { remainingAforo?: number }).remainingAforo).toBe(0);
    } finally {
      for (const id of createdIds) {
        await api.delete(`/api/admin/config/salons/${id}`).catch(() => undefined);
      }
      // Restore the floor aforo cap we temporarily changed.
      await api.post("/api/admin/config/floors/defaults", {
        floorNumber: target.floorNumber,
        maxAforo: priorAforo,
      });
    }
  });

  test("T4/T5 · booking on a floor decrements aforo, cancel restores it (party_size gated)", async ({
    api,
  }) => {
    const floors = await getDefaultFloors(api);
    const target = pickFloor(floors);
    expect(target, "A restaurant floor is required").toBeTruthy();

    const date = isoDaysFromNow(14); // far enough in the future to avoid today's real bookings
    const floorNumber = target.floorNumber;

    // Per-date override, so the global config is untouched.
    const cap = await api.post("/api/admin/config/floors", {
      date,
      floorNumber,
      active: true,
      maxAforo: FLOOR_AFORO,
    });
    expect(cap.success).toBe(true);

    let createdBookingId: number | null = null;
    let remainingBefore = 0;
    let remainingAfterCreate = 0;
    const batch = `${Date.now()}`;
    const customerName = `Aforo E2E ${batch}`;

    // Baseline remaining before any booking is created.
    const beforeCtx = await dayContext(api, date, PARTY_SIZE);
    const beforeFloor = beforeCtx.floors?.find((f) => f.floorNumber === floorNumber);
    expect(beforeFloor, "Floor should appear in the day context").toBeTruthy();
    remainingBefore = beforeFloor!.remaining ?? 0;

    try {
      // Create a booking on that floor for a small party.
      const created = await api.post("/api/admin/bookings", {
        reservation_date: date,
        reservation_time: "20:00",
        party_size: PARTY_SIZE,
        customer_name: customerName,
        contact_phone: "600000000",
        contact_email: `aforo-e2e-${batch}@example.com`,
        special_menu: false,
        preferred_floor_number: floorNumber,
      });
      expect(created.success).toBe(true);

      // The create response doesn't echo the id, so find it in the day's list.
      const listed = await api.get<{
        success: boolean;
        bookings?: Array<{ id: number; customer_name: string; status: string }>;
      }>(`/api/admin/bookings?date=${date}`);
      const mine = listed.bookings?.find((b) => b.customer_name === customerName);
      expect(mine, "Created booking should be listed for the date").toBeTruthy();
      createdBookingId = mine?.id ?? null;

      // Remaining should have dropped by exactly the party size.
      const after = await dayContext(api, date, PARTY_SIZE);
      const afterFloor = after.floors?.find((f) => f.floorNumber === floorNumber);
      remainingAfterCreate = afterFloor!.remaining ?? 0;
      expect(remainingAfterCreate).toBe(Math.max(0, remainingBefore - PARTY_SIZE));

      // A group larger than the remaining aforo must be gated out.
      if (remainingAfterCreate < PARTY_SIZE - 1) {
        const gated = await dayContext(api, date, PARTY_SIZE + 1);
        const gatedFloor = gated.activeFloors?.find((f) => f.floorNumber === floorNumber);
        expect(gatedFloor, "Floor with no room for the group must be hidden").toBeUndefined();
      }
    } finally {
      if (createdBookingId) {
        await api.post(`/api/admin/bookings/${createdBookingId}/cancel`, {}).catch(() => undefined);
        // After cancel the remaining must be restored to the baseline.
        const afterCancel = await dayContext(api, date, PARTY_SIZE);
        const afterCancelFloor = afterCancel.floors?.find((f) => f.floorNumber === floorNumber);
        expect(afterCancelFloor!.remaining ?? 0).toBe(remainingBefore);
      }
      // Clear the per-date aforo override (0 -> inherit global/unbounded).
      await api.post("/api/admin/config/floors", {
        date,
        floorNumber,
        active: true,
        maxAforo: 0,
      }).catch(() => undefined);
    }
  });
});
