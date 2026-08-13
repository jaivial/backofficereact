# POS Cash Day, Date Scoping & Realtime — Implementation Plan

> **Status:** Not started. Research complete (see §1 for the audited baseline).
> **Primary outcome:** an auditable **cash day** (`día de caja`) that groups N terminal
> shifts per business day, a date-scoped POS reports view driven by the existing
> `bo-datePop--mcal` afluencia picker, and POS realtime replacing the 5 s kitchen poll.
> **Implementation rule:** the cash day is the new financial aggregation root. Shifts,
> cash movements and X/Y/Z closures all hang off it. Opening and closing a cash day is
> transactional and idempotent, exactly like ticket checkout.

---

## 1. Audited baseline

Everything below was verified against the current tree before this plan was written.

### 1.1 Frontend (`backoffice/`)

| Concern | Location |
| --- | --- |
| Route entry | `pages/app/pos/+Page.tsx` (1 line, re-export) → `pages/app/pos/pos.tsx` (117 lines) |
| Section state | `pos.tsx:48` — `"sell" \| "kitchen" \| "catalog" \| "stock" \| "reports" \| "settings"` |
| Register hook | `pages/app/pos/hooks/usePOSRegister.ts` (415 lines); `request()` `:10-17`, `money()` `:18-21`, `load()` `:63-69`, exports `:399-414` |
| Domain types | `pages/app/pos/types/register.ts` (14 lines) |
| Three-dots menu | `pages/app/pos/functionalComponents/POSSellScreen/POSSectionMenu.tsx` — `SECTIONS` `:11-18`, fullscreen items `:69-93` |
| Cash UI | `pages/app/pos/functionalComponents/CashControl/CashControl.tsx` (66 lines) |
| Shift toggle (buried in Settings) | `pages/app/pos/functionalComponents/POSAdminPanel/POSAdminPanel.tsx` — `Shift` type `:12`, `toggleShift()` `:40`, UI `:52` |
| Kitchen poll | `pages/app/pos/functionalComponents/KitchenDisplay/KitchenDisplay.tsx:17` — `setInterval(load, 5000)` |
| POS modals | `POSPromptModal.tsx` (115 lines), `POSMultiSelectDialog.tsx` (43 lines); inline `.pos-modalBackdrop` pairs in `POSSellScreen.tsx:365-606` |
| Shared overlays | `ui/overlays/{Modal,ConfirmDialog,InfoModal,Popover}.tsx`; portal target `#bo-portal` at `pages/+Layout.tsx:75` |
| Date picker | `ui/widgets/MonthCalendarDatePicker.tsx` (props `:13-27`, class string `:138`) wrapping `ui/widgets/MonthCalendar.tsx` (occupancy `:178-230`) |
| Afluencia type | `api/types.ts:97-103` — `CalendarDay { date, booking_count, total_people, limit, is_open }` |
| Afluencia endpoint | `api/client.ts:835-838` → `GET /api/admin/calendar?year&month` |
| Date-param reference impl | `pages/app/reservas/tables/tables.tsx:868-871` (read), `:2564-2582` (write); helpers `pages/app/reservas/tables/helpers/tables.ts:59-73` |
| WS reference impl | `pages/app/reservas/tables/tables.tsx:1608-1745` |
| WS proxy allowlist | `server/index.ts:547` (8 paths, **no POS**); rewrite `:525-527`, cookie filter `:586-588`, `4401` on auth failure `:606` |
| POS CSS | `components/styles/features/pos/sell-screen.css` — modals `:498-560`, section menu `:646-682` |
| Picker CSS | `components/styles/components/dropdown.css:189-246`, `features/reservas/calendar.css:2-21`, `components/stepper.css:904+` |

**Known frontend debt this plan must not propagate:** `request()` is duplicated 5×; `POSSection`
is declared 2×; `ShiftSummary` and `Shift` describe the same row with different fields; POS
modals have no Escape handler and no focus trap; POS has zero query-param handling and zero
WebSocket usage.

### 1.2 Backend (`backend/`)

| Concern | Location |
| --- | --- |
| `pos_shifts` schema | `internal/db/migrations/065_pos_sales.sql:1-21` |
| `pos_cash_movements`, `pos_cash_closures` | `internal/db/migrations/084_pos_cash_closures.sql` |
| Latest migration | `093_restaurant_tables_numero_mesa_varchar.sql` → **next is `094`** |
| Shift handlers | `internal/api/backoffice_pos_operations.go:367` (current), `:384` (open), `:406` (close) |
| Cash handlers | `internal/api/backoffice_pos_cash.go` (436 lines): `loadPOSCashSummary` `:76`, `posCashShiftID` `:143`, summary `:153`, movements `:173`/`:201`, closures `:259`/`:291`/`:411` |
| Route registration | `internal/api/server.go:393-401` (shifts + cash), `:434-441` (covers + reports) |
| Existing POS realtime | `internal/api/backoffice_pos_stock_realtime.go` (+ `_test.go`) |
| Reports already date-aware | `backoffice_pos_reports.go:15-16` and `backoffice_pos_checkout.go:676-683` both read `from`/`to` |

Critical schema facts:

- `pos_shifts` has a generated column `open_terminal_key` plus
  `UNIQUE KEY uq_pos_shift_open_terminal (restaurant_id, open_terminal_key)` —
  **one open shift per terminal is enforced at the DB level.** Reuse this trick for cash days.
- `pos_cash_movements` and `pos_cash_closures` both carry
  `CONSTRAINT fk_..._shift FOREIGN KEY (restaurant_id, shift_id) REFERENCES pos_shifts(restaurant_id, id)`.
- `pos_shifts` open/close currently accept **no idempotency key** (`backoffice_pos_operations.go:384-405`),
  unlike every other POS write.
- `pos_visits` carries `service_date DATE` and `service_type ENUM('LUNCH','DINNER','OTHER')`.
- `pos_settings.business_day_cutoff` exists (surfaced as `Settings.businessDayCutoff`,
  `types/register.ts:1`, default `"05:00"`) but **the frontend never derives a business day from it**.

---

## 2. Scope

### Included

- **Workstream A — Cash day (A-full).** New `pos_cash_days` aggregation root, one open cash day
  per restaurant, grouping N shifts. Open/close endpoints, business-day derivation from
  `business_day_cutoff`, closure re-parenting, POS UI surfaced in the three-dots menu.
- **Workstream B — Date scoping.** `?date=` query param on `/app/pos`, `MonthCalendarDatePicker`
  in the POS header for the `reports` section, `from`/`to` forwarded to existing endpoints.
- **Workstream C — Realtime.** `/api/admin/pos/ws`, proxy allowlist entry, client hook,
  removal of the `KitchenDisplay` poll, cash-day events.
- **Workstream 0 — Prerequisites.** Deduplicate `request()`, unify `POSSection`, unify shift types.

### Explicit non-goals

- Reworking X/Y/Z closure arithmetic. `loadPOSCashSummary` (`backoffice_pos_cash.go:76`) keeps its
  per-shift semantics; the cash day adds a roll-up on top, it does not replace it.
- Multi-terminal offline conflict resolution.
- Date-scoping the **sell** screen. The register is always "now".
- Certified fiscal reporting (unchanged non-goal from `POS_IMPLEMENTATION_PLAN.md`).
- Replacing the POS inline-modal system with `ui/overlays/Modal`. Out of scope; see §7.4.

---

## 3. Workstream 0 — Prerequisites

Blocks A, B and C. Ship as its own PR; it should be a pure refactor with no behaviour change.

### 0.1 Deduplicate `request()`

Five copies exist: `hooks/usePOSRegister.ts:10-17`, `pos.tsx:27-34`, `CashControl.tsx:7-11`,
`POSAdminPanel.tsx:16`, `KitchenDisplay.tsx:7-11`.

- Create `pages/app/pos/utils/posRequest.ts` exporting `posRequest<T>(path, init)` and
  `money(cents)`, lifted **verbatim** from `usePOSRegister.ts:10-21`. Preserve the
  `/api/admin/pos` prefix, `credentials: "include"`, `Content-Type` header and the
  `!response.ok || !body.success` throw.
- Replace all five local definitions with imports.
- `pos.tsx:35-40` `stockRequest` stays — different prefix (`/api/admin/stock`).
- **Verify:** `rg -c "async function request|async function posRequest" pages/app/pos/` returns
  only the new module.

### 0.2 Unify `POSSection`

Declared at `POSSectionMenu.tsx:9` and again at `pos.tsx:48`. Keep the menu's export, import it
in `pos.tsx`.

### 0.3 Unify shift types

`ShiftSummary` (`types/register.ts:11`) and `Shift` (`POSAdminPanel.tsx:12`) are the same row.
`GET /pos/shifts/current` returns `{id, terminalKey, status, openingCashCents, openedAt}`
(`backoffice_pos_operations.go:382`). Widen to:

```ts
export type ShiftSummary = {
  id: number;
  status: string;
  terminalKey?: string;
  openingCashCents?: number;
  openedAt?: string;
  closedAt?: string | null;
};
```

Delete `POSAdminPanel.tsx:12` and import. `/bootstrap` keeps returning `currentShift`.

**Exit criteria:** `npx tsc --noEmit` clean; existing `e2e/specs/pos/` specs green.

---

## 4. Workstream A — Cash day (A-full)

### A.1 Migration `094_pos_cash_days.sql`

```sql
CREATE TABLE IF NOT EXISTS pos_cash_days (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    business_date DATE NOT NULL,
    status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
    opened_by INT NOT NULL,
    closed_by INT NULL,
    opening_cash_cents BIGINT NOT NULL DEFAULT 0,
    counted_cash_cents BIGINT NULL,
    expected_cash_cents BIGINT NULL,
    difference_cents BIGINT NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    note VARCHAR(500) NULL,
    discrepancy_reason VARCHAR(500) NULL,
    open_idempotency_key VARCHAR(120) NOT NULL,
    close_idempotency_key VARCHAR(120) NULL,
    open_marker TINYINT GENERATED ALWAYS AS (CASE WHEN status='OPEN' THEN 1 ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pos_cash_days_tenant_id (restaurant_id, id),
    UNIQUE KEY uq_pos_cash_day_open (restaurant_id, open_marker),
    UNIQUE KEY uq_pos_cash_day_date (restaurant_id, business_date),
    UNIQUE KEY uq_pos_cash_day_open_idem (restaurant_id, open_idempotency_key),
    KEY idx_pos_cash_days_restaurant (restaurant_id, status, business_date),
    CONSTRAINT fk_pos_cash_days_restaurant FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT chk_pos_cash_day_cash CHECK (
      opening_cash_cents >= 0 AND (counted_cash_cents IS NULL OR counted_cash_cents >= 0)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pos_shifts
  ADD COLUMN cash_day_id BIGINT UNSIGNED NULL AFTER restaurant_id,
  ADD KEY idx_pos_shifts_cash_day (restaurant_id, cash_day_id),
  ADD CONSTRAINT fk_pos_shifts_cash_day
    FOREIGN KEY (restaurant_id, cash_day_id) REFERENCES pos_cash_days(restaurant_id, id);

ALTER TABLE pos_cash_closures
  ADD COLUMN cash_day_id BIGINT UNSIGNED NULL AFTER shift_id,
  ADD COLUMN scope ENUM('SHIFT','CASH_DAY') NOT NULL DEFAULT 'SHIFT' AFTER closure_type,
  ADD KEY idx_pos_cash_closures_cash_day (restaurant_id, cash_day_id, generated_at),
  ADD CONSTRAINT fk_pos_cash_closures_cash_day
    FOREIGN KEY (restaurant_id, cash_day_id) REFERENCES pos_cash_days(restaurant_id, id);
```

Design notes:

- `open_marker` + `uq_pos_cash_day_open` mirrors the existing `open_terminal_key` trick
  (`065_pos_sales.sql:14,17`) — **one open cash day per restaurant, enforced by the DB.**
- `uq_pos_cash_day_date` prevents reopening a business date.
- `cash_day_id` is **nullable** on `pos_shifts` and `pos_cash_closures` so historical rows
  survive. `pos_cash_movements` is deliberately **not** touched — it stays shift-scoped and rolls
  up through `pos_shifts.cash_day_id`.
- Add the new tables/constraints to `internal/db/migrations/schema_constraints_test.go`.

### A.2 Backfill (same migration file, after the DDL)

```sql
INSERT INTO pos_cash_days (restaurant_id, business_date, status, opened_by, closed_by,
                           opening_cash_cents, opened_at, closed_at, open_idempotency_key)
SELECT s.restaurant_id, DATE(s.opened_at), 'CLOSED', s.opened_by, s.closed_by,
       MIN(s.opening_cash_cents), MIN(s.opened_at), MAX(s.closed_at),
       CONCAT('backfill:', s.restaurant_id, ':', DATE(s.opened_at))
FROM pos_shifts s
WHERE s.status = 'CLOSED'
GROUP BY s.restaurant_id, DATE(s.opened_at), s.opened_by, s.closed_by;

UPDATE pos_shifts s
JOIN pos_cash_days d ON d.restaurant_id = s.restaurant_id
                    AND d.business_date = DATE(s.opened_at)
SET s.cash_day_id = d.id
WHERE s.cash_day_id IS NULL;

UPDATE pos_cash_closures c
JOIN pos_shifts s ON s.restaurant_id = c.restaurant_id AND s.id = c.shift_id
SET c.cash_day_id = s.cash_day_id
WHERE c.cash_day_id IS NULL;
```

Backfill uses naive `DATE(opened_at)`, **not** the cutoff — historical grouping is
informational only. Currently-`OPEN` shifts are left with `cash_day_id = NULL` and are adopted by
the first `POST /pos/cash-days/open` (A.4).

### A.3 Business-day derivation

New helper in `internal/api/backoffice_pos_cash.go` (next to `posCashShiftID` at `:143`):

```go
// posBusinessDate returns the business date for t given the tenant cutoff ("HH:MM").
// A cutoff of 05:00 means 2025-08-09 03:10 belongs to business date 2025-08-08.
func posBusinessDate(t time.Time, cutoff string, loc *time.Location) string
```

- Parse `cutoff` with `time.Parse("15:04", cutoff)`; on parse failure fall back to `"05:00"`
  (same default as `usePOSRegister.ts:8`).
- Load `timezone` and `business_day_cutoff` from `pos_settings` in the same query as the rest of
  the settings read. Fall back to `Europe/Madrid` if the tz is empty or invalid.
- **Unit test first** (`backoffice_pos_cash_test.go`): DST boundaries, midnight, exactly-at-cutoff,
  cutoff `00:00`, invalid cutoff, invalid tz.

### A.4 Endpoints

Register in `internal/api/server.go` immediately before the shift routes at `:393`, reusing the
exact middleware chains already in use there:

```go
r.With(s.requireBOSession, s.requireBOPOSFeature, withBOPOSTimeout, posViewGate).
  Get("/pos/cash-days/current", s.handleBOPOSCashDayCurrent)
r.With(s.requireBOSession, s.requireBOPOSFeature, withBOPOSTimeout, posReportsGate).
  Get("/pos/cash-days", s.handleBOPOSCashDayList)
r.With(s.requireBOSession, s.requireBOPOSFeature, withBOPOSTimeout, posShiftGate).
  Post("/pos/cash-days/open", s.handleBOPOSCashDayOpen)
r.With(s.requireBOSession, s.requireBOPOSFeature, withBOPOSTimeout, posShiftGate).
  Post("/pos/cash-days/{id}/close", s.handleBOPOSCashDayClose)
```

New file: `internal/api/backoffice_pos_cash_day.go`.

**`GET /pos/cash-days/current`** → `{success, cashDay: {...} | null, shifts: [...]}`.
Mirror the shape of `handleBOPOSShiftCurrent` (`backoffice_pos_operations.go:367-383`), returning
`null` on `sql.ErrNoRows`. Include `openShiftCount` and a live `expectedCashCents` roll-up.

**`GET /pos/cash-days?from=&to=`** → `{success, items: [...]}`. Defaults mirror
`handleBOPOSCoversReport` (`backoffice_pos_checkout.go:676-683`): `from` = 30 days ago, `to` = today.
Consumed by Workstream B.

**`POST /pos/cash-days/open`** — body `{openingCashCents, note, idempotencyKey}`.
1. `BeginTx`.
2. Reject with `409` / `CASH_DAY_ALREADY_OPEN` if a row with `status='OPEN'` exists — but first
   check `open_idempotency_key`; a replayed key returns `200` with the existing row.
3. `business_date = posBusinessDate(now, cutoff, loc)`; reject `409` / `CASH_DAY_DATE_CLOSED` on
   `uq_pos_cash_day_date` violation.
4. Insert, then adopt any orphan open shifts:
   `UPDATE pos_shifts SET cash_day_id=? WHERE restaurant_id=? AND status='OPEN' AND cash_day_id IS NULL`.
5. Commit, broadcast `cash_day_opened` (Workstream C), return `201 {success, id, cashDay}`.

**`POST /pos/cash-days/{id}/close`** — body `{countedCashCents, discrepancyReason, note, idempotencyKey}`.
1. `BeginTx`, `SELECT ... FOR UPDATE` on the cash day; `409` unless `status='OPEN'`
   (same guard style as `handleBOPOSShiftClose`, `backoffice_pos_operations.go:424-427`).
2. **Refuse** with `409` / `CASH_DAY_HAS_OPEN_SHIFTS` if any child shift is still `OPEN`.
   Do **not** auto-close shifts — that would silently skip the per-shift Z close.
3. **Refuse** with `409` / `CASH_DAY_HAS_OPEN_VISITS` if open visits/tickets exist. Reuse the
   existing check from `handleBOPOSCashClosureCreate` (`backoffice_pos_cash.go:291+`) rather than
   writing a second one.
4. Roll up expected cash across child shifts via `loadPOSCashSummary` per shift
   (`backoffice_pos_cash.go:76` — already accepts a `posCashQueryer`, so pass `tx`).
5. Persist `counted_cash_cents`, `expected_cash_cents`, `difference_cents`, `closed_by`, `closed_at`,
   `status='CLOSED'`, `close_idempotency_key`.
6. Write a `pos_cash_closures` row with `scope='CASH_DAY'`, `closure_type='Z'`, `cash_day_id=?`,
   `shift_id` = the last child shift (FK is `NOT NULL`).
7. Commit, broadcast `cash_day_closed`, return `200 {success, cashDay, closureId, summary}`.

**Changes to existing shift endpoints** (`backoffice_pos_operations.go`):

- `handleBOPOSShiftOpen` `:384` — reject `409` / `NO_OPEN_CASH_DAY` when no cash day is open;
  otherwise stamp `cash_day_id`. Also add `idempotencyKey` to the request body for consistency
  with the rest of POS.
- `handleBOPOSShiftClose` `:406` — unchanged logic; include `cashDayId` in the response.
- `handleBOPOSShiftCurrent` `:367` — add `cashDayId` to the returned map at `:382`.
- `handleBOPOSCashClosureCreate` (`backoffice_pos_cash.go:291`) — stamp `cash_day_id` from the
  shift and set `scope='SHIFT'`.

### A.5 Frontend types

`pages/app/pos/types/register.ts`:

```ts
export type CashDaySummary = {
  id: number;
  businessDate: string;          // yyyy-mm-dd
  status: "OPEN" | "CLOSED";
  openingCashCents: number;
  expectedCashCents?: number;
  countedCashCents?: number | null;
  differenceCents?: number | null;
  openedAt: string;
  closedAt?: string | null;
  openShiftCount?: number;
};
```

Add `cashDayId?: number | null` to `ShiftSummary` (as widened in 0.3) and
`currentCashDay?: CashDaySummary | null` to `Bootstrap` (`:13`). Backend `/bootstrap` must return it.

### A.6 Frontend state — `usePOSRegister`

Add next to `currentShift` (`hooks/usePOSRegister.ts:34`, hydrated `:67`):

```ts
const [currentCashDay, setCurrentCashDay] = useState<CashDaySummary | null>(null);
```

Add four actions modelled on `openDrawer` (`:254-265`) — same `commandInFlight`/`commandKeys`
guards (`:59-61`) and `idempotencyKey: crypto.randomUUID()`:

| Action | Call |
| --- | --- |
| `openCashDay(openingCashCents, note?)` | `POST /cash-days/open` |
| `closeCashDay(countedCashCents, discrepancyReason?, note?)` | `POST /cash-days/{id}/close` |
| `refreshCashDay()` | `GET /cash-days/current` |
| `openShift` / `closeShift` | `POST /shifts/open`, `POST /shifts/{id}/close` |

Export all from the return object at `:399-414`. `closeCashDay` must also re-run `load()`.
Surface backend error codes as Spanish copy matching the existing style
(`"Abre un turno antes de usar el cajón."`, `usePOSRegister.ts:264`):

| Code | Copy |
| --- | --- |
| `NO_OPEN_CASH_DAY` | `Abre la caja del día antes de abrir un turno.` |
| `CASH_DAY_ALREADY_OPEN` | `Ya hay una caja abierta.` |
| `CASH_DAY_HAS_OPEN_SHIFTS` | `Cierra todos los turnos antes de cerrar la caja del día.` |
| `CASH_DAY_HAS_OPEN_VISITS` | `Hay visitas o tickets abiertos.` |
| `CASH_DAY_DATE_CLOSED` | `La caja de este día ya fue cerrada.` |

### A.7 Frontend UI

**Menu entry** — `POSSectionMenu.tsx`. Add props to the signature (`:22-25`):
`cashDayOpen: boolean; onCashDay: () => void`. After the fullscreen block (`:93`) append a
separator + action item, copying the existing item markup but with `role="menuitem"` (an action,
not a radio):

```tsx
<li role="separator" className="pos-sectionMenuSeparator" />
<li role="none">
  <button type="button" role="menuitem" className="pos-sectionMenuItem"
          data-testid="pos-cashday-toggle"
          onClick={() => { onCashDay(); setOpen(false); }}>
    {cashDayOpen ? "Cerrar caja del día" : "Abrir caja del día"}
  </button>
</li>
```

Wire at `pos.tsx:100`.

**Modals** — reuse `POSPromptModal` (`POSSellScreen/POSPromptModal.tsx:60-114`). It already
supports `fields: PromptField[]`, `summary`, `busy`, `validate`. Do **not** author a new modal.

- Open: one `kind:"input"` field `openingCashCents` ("Efectivo inicial €"),
  `confirmLabel="Abrir caja"`, `testId="pos-cashday-open"`.
- Close: fields `countedCashCents` ("Efectivo contado €") + `discrepancyReason`,
  `summary` rendering the expected-cash roll-up from `GET /cash-days/current`,
  `confirmLabel="Cerrar caja"`, `testId="pos-cashday-close"`, followed by a
  `ConfirmDialog` (`ui/overlays/ConfirmDialog.tsx`, `danger`) confirmation step.
  Render `409` errors inline via the existing `__error` slot.

Own the modal state in `pos.tsx` (not `POSSellScreen`) so the action works from every section.

**Header badge** — in `pos.tsx:100` beside the stock/covers badge:
`Caja abierta · 08 ago` / `Caja cerrada`, with `data-testid="pos-cashday-status"`.
New `.pos-cashDayBadge` rule in `components/styles/features/pos/sell-screen.css` near the header
block; use `var(--bo-text-success)` / `var(--bo-muted)`, no new colour tokens.

**Gate enforcement** — currently only `openDrawer` (`usePOSRegister.ts:254-265`) and the `cajon`
rail button (`POSSellScreen.tsx:224`) honour `settings.requireOpenShift`. Extend the same guard to
`checkout`, and disable `cobrar` in `POSControlRail.tsx` via the existing `RailFeatureKey`
mechanism (`:3-7`).

**Settings panel** — keep `POSAdminPanel.tsx:52` (`data-ui="pos-admin-shift-toggle"`); e2e may
assert on it. Make it read cash-day/shift state from the hook so the two UIs cannot diverge, and
show a disabled state with a hint when no cash day is open.

**Reports** — `CashControl.tsx` gains a cash-day header above the existing per-shift summary
(`:56-59`). Its `"No hay turno abierto."` empty state (`:58`) becomes
`"No hay caja abierta."` when there is no cash day.

### A.8 Tests

- Go unit: `posBusinessDate` table test (DST, midnight, at-cutoff, `00:00`, invalid inputs).
- Go integration (`backoffice_pos_cash_day_integration_test.go`): open → open shift → close shift
  → close cash day happy path; `409` on each refusal branch; idempotent replay of both keys;
  concurrent double-open hits `uq_pos_cash_day_open`.
- Migration: extend `internal/db/migrations/schema_constraints_test.go`; assert the backfill leaves
  no `pos_cash_closures` row with `cash_day_id IS NULL` where its shift has one.
- Vitest `pages/app/pos/hooks/usePOSRegister.test.ts`: `openCashDay`/`closeCashDay` send an
  idempotency key; each error code maps to its Spanish string; `requireOpenShift` blocks checkout.
- Playwright `e2e/specs/pos/cash-day.spec.ts`: `[data-testid="pos-section-menu"]` →
  `[data-testid="pos-cashday-toggle"]` → `[data-testid="pos-cashday-open"]` → assert
  `[data-testid="pos-cashday-status"]` flips and `cobrar` enables; then the close path including
  the open-shift refusal.

---

## 5. Workstream B — Date scoping + afluencia picker

Applies to the `reports` section only.

### B.1 `?date=` query param

- Move `isValidISODate`, `initialDateFromSearch` and `withDateParam` from
  `pages/app/reservas/tables/helpers/tables.ts:59-73` to `lib/dateParam.ts` and re-export from the
  original module so `tables.tsx` needs no edit.
- In `pos.tsx`, read SSR-safely exactly as `tables.tsx:868-871` does:
  ```ts
  const initialDate = useMemo(
    () => initialDateFromSearch(pageContext.urlParsed?.search?.date, todayISO()),
    [pageContext.urlParsed?.search?.date],
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  ```
- Write back without navigation, as `tables.tsx:2564-2582` does, via
  `window.history.replaceState` + `withDateParam`.
- **Do not** add a `+data.ts`. POS is client-loaded; adding SSR data is a separate change.

### B.2 Forward the date

`pos.tsx:94` currently calls `/covers` and `/reports/sales` with no params. Append
`?from=${selectedDate}&to=${selectedDate}`. **No backend change needed** —
`backoffice_pos_checkout.go:676` and `backoffice_pos_reports.go:15` already read them.

`CashControl` stays shift/cash-day scoped; a closure belongs to a cash day, not a calendar day.
Once A ships, add a cash-day selector there fed by `GET /pos/cash-days?from=&to=`.

### B.3 Mount the picker

In the `pos.tsx:100` header, rendered only when `section === "reports"`:

```tsx
<MonthCalendarDatePicker
  value={selectedDate} onChange={onSelectDate}
  year={calYear} month={calMonth} days={calendarDays}
  onPrevMonth={prevMonth} onNextMonth={nextMonth}
  loading={calLoading}
  data-testid="pos-date-picker"
/>
```

Props contract: `ui/widgets/MonthCalendarDatePicker.tsx:13-27`. It portals into `#bo-portal`
(`pages/+Layout.tsx:75`), so POS fullscreen is structurally safe — still verify visually, because
`pages/app/+Layout.tsx:24-27` sets `body { overflow: hidden }` app-wide.

### B.4 Feed `days`

Reuse the existing endpoint exactly as tables does: `api.calendar.getMonth({year, month})`
(`api/client.ts:835-838`) → `CalendarDay[]` (`api/types.ts:97-103`). Model the state and effect on
`tables.tsx:880, 1203, 1289`; refetch on month change only. Occupancy tinting is automatic
(`MonthCalendar.tsx:178-230` → `.occ-50/75/85/100`, `features/reservas/calendar.css:2-21`).

> **Open item.** `CalendarDay` is *reservations* afluencia (`total_people / limit`), not POS
> covers. If the requirement is POS-covers tinting, a new endpoint is needed — decide before
> building B.4.

### B.5 CSS check

`.bo-datePop--mcal` is 344 px wide at `z-index: 9999`
(`components/styles/components/dropdown.css:206-246`, `:191`). Confirm it stacks above
`.pos-modalBackdrop` (`features/pos/sell-screen.css:498`) and the fullscreen shell. Fix only if it
doesn't; avoid a blanket z-index bump.

### B.6 Tests

Playwright `e2e/specs/pos/pos-date-picker.spec.ts`, cloning the selectors from
`e2e/specs/tables/table-map-date-picker.spec.ts`: `[data-testid="pos-date-picker"]`,
`[data-ui="date-picker-popover"]`, `[data-testid^="month-calendar-day-"][data-date=...]`,
`[data-testid="month-calendar-prev"]`/`-next`. Assert the URL gains `?date=` and that the reports
request carries `from`/`to`.

---

## 6. Workstream C — POS realtime

### C.1 Proxy allowlist

`server/index.ts:547` — add `/api/admin/pos/ws`. Nothing else changes: the
`/api/admin/*` → `/admin/*` rewrite (`:525-527`), the cookie-only header filter (`:586-588`) and
the `4401` close on auth failure (`:606`) are all generic.

### C.2 Backend hub

**Read `internal/api/backoffice_pos_stock_realtime.go` first.** If it already exposes a hub,
extend it; do not add a second one. Otherwise model on the tables hub. Register the route in
`server.go` near `:393` with the same chain
(`requireBOSession`, `requireBOPOSFeature`, `posViewGate`).

### C.3 Message contract

Flat JSON with a snake_case `type`, per repo convention (`tables.tsx:1619-1735`,
`FichajeRealtimeBridge.tsx:162-217`).

- **Inbound:** `snapshot`, `visit_updated`, `ticket_updated`, `kitchen_order_updated`,
  `shift_opened`, `shift_closed`, `cash_movement_created`, `closure_created`,
  `cash_day_opened`, `cash_day_closed`.
- **Outbound:** `join_terminal` (mirrors `join_restaurant`, `FichajeRealtimeBridge.tsx:151`).

Every payload carries `restaurantId`, and `version` where the entity has one, so the existing
optimistic-concurrency logic in `usePOSRegister` can drop stale frames.

### C.4 Client hook

New `pages/app/pos/hooks/usePOSRealtime.ts`, modelled on `tables.tsx:1608-1745` — a
per-component `useEffect` socket, not the singleton-atom bridge (POS is a single page):

```ts
const proto = window.location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${proto}://${window.location.host}/api/admin/pos/ws`);
```

Include the pending-send queue (`tables.tsx:1766-1772`), reconnect-with-backoff (copy from
`FichajeRealtimeBridge.tsx:144`) and a `try { JSON.parse } catch { /* ignore malformed */ }`
guard on every frame.

### C.5 Consumers

- `KitchenDisplay.tsx:17` — delete the `setInterval`; keep `load()` as the initial fetch plus a
  manual refresh fallback when the socket is down.
- `usePOSRegister` — apply `visit_updated`/`ticket_updated` only when
  `payload.version > local.version`.
- `cash_day_opened`/`cash_day_closed`/`shift_*` — update the A.7 badge without refetching.

### C.6 Tests

Go integration test alongside `backoffice_pos_stock_realtime_test.go`. Frontend: a vitest unit
test for the pure frame-reducer. No e2e for sockets.

---

## 7. Sequencing, risks, open items

### 7.1 Order

`0` → `A.1–A.4` (backend) → `A.5–A.8` (frontend) → `B` → `C`.
B is independent of A after Workstream 0 and can be parallelised. C is last: it depends on A's
cash-day events and touches the most surface.

### 7.2 Rollout

Migration `094` is additive and backward compatible (`cash_day_id` nullable), so the backend can
ship before the frontend. The `NO_OPEN_CASH_DAY` gate in `handleBOPOSShiftOpen` is the one
breaking change — put it behind a `pos_settings` flag (`requireOpenCashDay`, defaulting to
`false`) and flip it per tenant once the UI is deployed.

### 7.3 Risks

1. **Backfill on live data.** `uq_pos_cash_day_date` will reject tenants whose historical shifts
   group ambiguously. Dry-run the two `UPDATE`s on a production snapshot before shipping.
2. **`CalendarDay` semantics** (B.4) — reservations afluencia ≠ POS covers.
3. **Cutoff correctness.** A wrong `posBusinessDate` silently misfiles revenue. Unit-test it
   before wiring anything to it.
4. **`pos_cash_closures.shift_id` stays `NOT NULL`**, so a cash-day closure must borrow a child
   shift id. Acceptable, but document it in the handler.

### 7.4 Pre-existing debt touched by this plan

- `functionalComponents/CardReconciliation/CardReconciliation.tsx` is a single minified line.
  Reformat it in its own commit before any edit lands there.
- POS inline modals have no Escape handler and no focus trap. Workstream A adds two more modal
  usages, so fix `POSPromptModal` once — port the Escape listener from `ui/overlays/Modal.tsx:49-56`
  — rather than accruing more.
- `POSAdminPanel.tsx` and `CashControl.tsx` are written as long single-line statements. Do not
  extend that style; new code follows the formatting used in `POSSectionMenu.tsx`.
