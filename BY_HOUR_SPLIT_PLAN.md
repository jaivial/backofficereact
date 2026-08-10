# Plan — "By-hour client split" toggle + per-hour capacity editor

## 0. Context / current state (verified)

- `GET /api/reservations/hour-data?date=` → backend `handleGetHourData`
  (`/var/www/newvillacarmen/backend/internal/api/hours.go`).
  - Returns `hourData: { "<HH:MM>": { capacity, totalCapacity, percentage, ... } }`.
  - Default path (`isDefaultData: true`) splits `dailyLimit` **equally** across active hours.
  - Stored path reads `hour_configuration.hourData` JSON (has per-slot `Percentage`).
- **Already exists, unused by UI**: `hours_percentage` table + handlers
  `handleGetHourPercentages` / `handleUpdateHourPercentages`
  (`hour_percentages.go`). Routes: `GET /api/gethourpercentages.php`,
  `POST /api/updatehourpercentages.php`. Auto-validates `sum(percentages)==100`.
  → **This is the canonical percentage store we should reuse.**
- Preact client (`/var/www/newvillacarmen/preactvillacarmen/frontend/src/routes/client/Reservas.tsx`,
  `availableHours` memo ~L730): filters each hour by `slot.capacity < partySize`.
- **No server-side enforcement** of capacity on booking insert
  (`booking_insert.go::insertBooking` just INSERTs). All gating is client-side.
  Daily limit gating uses month-availability (`freeBookingSeats`) on the calendar.
- Backoffice pages:
  - `/app/reservas/config` → `pages/app/reservas/config/config.tsx` + `hooks/useConfigDay.ts`.
    "Horario del día" panel is the anchor for the new section.
  - `/app/config` → `pages/app/config/config.tsx` → `ConfigRestaurante.tsx`
    ("Horarios por defecto" panel is the anchor).
- Reusable assets present:
  - `ui/shadcn/Switch.tsx` (Headless UI toggle — this is the "reusable toggle switch").
  - `ui/shadcn/chart.tsx` (Recharts wrapper; Pie/Donut available).
  - `ui/widgets/DonutOccupancy.tsx` (reference for donut styling).

## 1. Data model (decision needed — recommended option A)

**Option A (recommended): reuse `hours_percentage` + add split flag column.**

- New column on per-date table:
  ```sql
  -- 096_reservation_hour_split_flag.sql
  ALTER TABLE reservation_manager
    ADD COLUMN hour_split_enabled TINYINT(1) NOT NULL DEFAULT 1;
  ```
  (`reservation_manager` already keyed per (restaurant_id, reservationDate), default-on
  preserves current behaviour.)
- New column on defaults table (decision #1 — full defaults incl. % template):
  ```sql
  ALTER TABLE restaurant_reservation_defaults
    ADD COLUMN hour_split_enabled TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN default_hour_percentages_json JSON NULL;
  ```
- **Canonical percentage source = `hours_percentage`** (`hoursPercentages` JSON).
  `hour_configuration.hourData.Percentage` becomes derived/cache only.

**Option B (rejected):** store flag inside `hour_configuration.hourData`. Worse —
mixes config shape with runtime, harder to query.

Effective flag per date = `reservation_manager.hour_split_enabled` if row exists,
else `restaurant_reservation_defaults.hour_split_enabled`, else `true`.

## 2. Backend changes (`/var/www/newvillacarmen/backend`)

### 2.1 Migration
`internal/db/migrations/096_reservation_hour_split_flag.sql` (both ALTERs above).
Register in `migrations.go` if it has an explicit list.

### 2.2 Modify `handleGetHourData` (`hours.go`)
- Resolve effective `hourSplitEnabled` (date override → default → true).
- Load percentages from `hours_percentage.hoursPercentages` (fall back equal split).
- **If enabled** (current behaviour, refined): `totalCapacity = ceil(pct/100 * dailyLimit)`,
  `capacity = totalCapacity - bookings[hour]`. (Use `hours_percentage` as source instead of
  `hour_configuration` to unify.)
- **If disabled**: omit `totalCapacity` from each slot; for every active hour set
  `capacity = max(0, dailyLimit - totalPeople)` (no per-hour cap), `percentage = 100/len(hours)`
  (informational only). Frontend renders **no donut** in this mode.
- Add to response: `"hourSplitEnabled": bool`, `"percentages": {hour:pct}`,
  `"hourlyCapacities": {hour:int}`.
- Keep `isDefaultData` semantics.

### 2.3 Admin endpoints (re-expose under `/api/admin/...`)
Add typed admin routes in `server.go` (mirror existing `config/*` group):
- `GET  /api/admin/config/hour-split?date=`        → flag + percentages + bookings + capacities.
- `POST /api/admin/config/hour-split`              → `{date, enabled}`.
- `POST /api/admin/config/hour-split-percentages`  → `{date, percentages}` (reuse
  `handleUpdateHourPercentages` logic; keep `sum==100` validation, return rebalanced set).
- Defaults equivalents under `/api/admin/config/defaults` (extend existing
  `getDefaults`/`setDefaults` payload with `hourSplitEnabled`).
  → extend `reservationDefaults` struct + `loadReservationDefaults`/`upsertReservationDefaults`
  in `backoffice_config.go`.

> Note: existing `*.php` hour-percentages handlers can stay as the public read; new
> `/api/admin/...` ones give the backoffice typed contract + write path.

### 2.4 Auto-balance rule (server authoritative)
On `POST .../hour-split-percentages`:
- Accept either `{hour: pct}` (already balanced, validate `|sum-100|<=0.1`) **or**
  `{hour: newPct}` single edit → server recomputes others:
  ```
  remaining = 100 - newPct
  othersSum = sum(others)
  for each other: o = round(remaining * o/othersSum, 2)
  fixRoundingOnLargest()
  ```
- People-count variant: client sends `people = X` for one hour → server converts
  `pct = X / dailyLimit * 100`, then runs same rebalance. DailyLimit read from
  `reservation_manager` (default 45).

## 3. Backoffice API client (`api/client.ts`)

Add to `config:` block:
```ts
async getHourSplit(date): Promise<APISuccess<HourSplitConfig>>
async setHourSplit(date, enabled): Promise<APISuccess<{ enabled: boolean }>>
async setHourSplitPercentages(date, percentages): Promise<APISuccess<{ percentages: Record<string, number> }>>
```
+ types in `api/types.ts`:
```ts
export type HourSplitConfig = {
  date: string;
  enabled: boolean;            // effective flag (date override > default)
  source: "override" | "default";
  dailyLimit: number;
  totalPeople: number;
  activeHours: string[];
  percentages: Record<string, number>;      // hour -> pct (sum 100), source of truth
  hourlyCapacities: Record<string, number>; // hour -> people (derived, present only if enabled)
  bookingsByHour: Record<string, number>;
};
```
Defaults equivalents: extend `ConfigDefaults` with `hourSplitEnabled: boolean` **and**
`defaultHourPercentages: Record<string, number>` (template applied to new dates).

## 4. Backoffice UI — reusable widget

### 4.1 New component `ui/widgets/HourSplitConfig/`
```
HourSplitConfig/
├── HourSplitConfig.tsx            # section: toggle + grid of HourSplitCard
├── HourSplitCard.tsx              # one hour: shadcn Pie Donut-with-text + editors
├── HourSplitConfig.test.tsx
├── HourSplitCard.test.tsx
├── lib/
│   ├── rebalance.ts               # pure fns: rebalanceByPct, rebalanceByPeople, toPct, toPeople
│   └── rebalance.test.ts
└── types.ts
```
- `HourSplitConfig` props (Open/Closed per AGENTS SOLID rule):
  ```ts
  {
    enabled: boolean;
    dailyLimit: number;
    activeHours: string[];
    percentages: Record<string, number>;
    hourlyCapacities: Record<string, number>;
    bookingsByHour: Record<string, number>;
    busy?: boolean;
    onToggleEnabled: (next: boolean) => void;
    onPercentagesChange: (next: Record<string, number>, changedHour: string) => void;
    onCommit: (percentages: Record<string, number>) => void; // debounce autosave
  }
  ```
- Uses `ui/shadcn/Switch` for the toggle (the required "reusable toggle switch").
- Per-hour card uses shadcn **Pie → "Donut with Text"** (`ChartContainer` + Recharts
  `Pie` `innerRadius/outerRadius` + centered `<text>` showing `bookings/capacity`).
  Config colors via `--bo-accent` (used) / `--bo-accent-2` (free).
- **When `enabled === false`: render NO donut/cards** — only the toggle + helper text
  ("Sin reparto por hora: se permite reservar cualquier hora mientras quede aforo diario").
- Each card exposes **two editors** (tab/segmented): **%** and **people**.
  - % mode: number input `0–100`; on change call `rebalanceByPct`.
  - people mode: number input `0..dailyLimit`; **derived only** — on change compute
    `pct = people/dailyLimit*100`, call `rebalanceByPct`. People display always recomputed
    from `%` (decision #2).
  - Live re-render of sibling donuts (optimistic local state), **debounced autosave 600 ms**
    via `onCommit`, **toast on success/error** via `useToasts` (decision #5).
- Tokens: all sizes/colors from `components/bo.css` (no hardcode). A11y: `role="group"`,
  `aria-label`, `:focus-visible`, reduced-motion respected.

### 4.2 Wire into `/app/reservas/config` (`config.tsx`)
- Add state: `hourSplit`, fetch inside existing `loadAll` (add `api.config.getHourSplit(d)`).
- New `<HourSplitConfig />` rendered **after** the "Horario del día" panel, inside the
  `day.isOpen` `AnimatePresence` block.
- Handlers live in `useConfigDay.ts`: `toggleHourSplit`, `commitHourSplitPercentages`
  (debounced), reusing the same `setBusy`/`pushToast`/`setError` pattern.
- Hidden/disabled when `!day.isOpen`.

### 4.3 Wire into `/app/config` → `ConfigRestaurante.tsx`
- Add defaults-equivalent section **after** "Horarios por defecto" panel.
- Per decision #1: edits **restaurant defaults** — the toggle + the **default-% template**
  (`defaultHourPercentages`) applied to any new date. Per-date override lives on
  `/app/reservas/config` and wins for that date.
- Operates on `restaurant_reservation_defaults` via extended
  `setDefaults({ hourSplitEnabled, defaultHourPercentages })`.
- Reuses the same `<HourSplitConfig />` widget in "defaults" mode (no live bookings, donut
  shows pure % split; `bookingsByHour` empty, `source: "default"`).

## 5. Preact client (`preactvillacarmen/frontend/src`)

### 5.1 `lib/types.ts`
- Extend `HourDataResponse` with `hourSplitEnabled?: boolean`.
- Extend `HourSlot` (no shape change needed; capacity semantics change).

### 5.2 `routes/client/Reservas.tsx` — `availableHours` memo (~L730)
```ts
const splitEnabled = hourData?.hourSplitEnabled !== false; // default true (backward compat)
for (const h of hours) {
  ...
  if (splitEnabled && typeof slot.capacity === 'number' && slot.capacity < partySize) continue;
  out.push({ hour: h, status: ... });
}
```
When disabled → all active hours shown as long as day-level `freeSeats >= partySize`
(existing calendar gating still applies). Endpoint shape unchanged (per requirement).

## 6. Testing (TDD per AGENTS.md)

### 6.1 Backend (Go)
- `hours_test.go`: enabled path (per-hour cap), disabled path (all hours open up to
  dailyLimit), percentages pulled from `hours_percentage`, flag override precedence.
- `hour_percentages_test.go`: rebalance by pct, rebalance by people, rounding fix,
  sum!=100 rejection.
- Reuse existing test DB harness (`*_test.go` patterns in package).

### 6.2 Backoffice (Vitest + RTL)
- `rebalance.test.ts`: pure logic first (failing → impl).
- `HourSplitCard.test.tsx`: renders donut + % editor + people editor; mock `lucide-react`
  + Recharts; assert `%` change rebalances siblings; assert people↔pct conversion.
- `HourSplitConfig.test.tsx`: toggle off hides cards; toggle on shows grid; autosave
  debounced call to `onCommit`.
- E2E `e2e/specs/reservas/reservas-hour-split.spec.ts`: toggle, edit one hour %, assert
  siblings rebalanced + persisted after reload (use `data-testid`).

### 6.3 Validation gates (before commit)
```bash
pnpm lint:jsx && pnpm lint:all && pnpm build    # backoffice
cd /var/www/newvillacarmen/backend && go test ./internal/api/...
cd preactvillacarmen/frontend && bun run build   # typecheck preact
```

## 7. Sequencing (suggested commits)

1. **Backend**: migration `096` + `handleGetHourData` split-aware + typed admin endpoints
   + rebalance logic + Go tests.
2. **Backoffice client**: `api/types.ts` + `config:` methods + unit stubs.
3. **Widget**: `rebalance.ts` (TDD) → `HourSplitCard` → `HourSplitConfig` (+ tests/stories).
4. **Wire reservas/config**: state + `useConfigDay` handlers + render + E2E.
5. **Wire default config**: flag toggle (+ optional default-percentages editor).
6. **Preact client**: type + `availableHours` guard; build/typecheck.

## 8. Locked decisions

1. **Defaults page = full restaurant defaults** (`/app/config`). Sets flag **and**
   default-% template. Per-date override (`/app/reservas/config`) wins for that date.
2. **`%` is source of truth.** People count always derived (`people = round(pct/100*limit)`).
   When `dailyLimit` changes, people floats, % stays fixed.
3. **Deprecate `hour_configuration.Percentage`** → `hours_percentage` canonical. Migrate
   once, stop writing `Percentage` in `hour_configuration`.
4. **Disabled mode: omit `totalCapacity`** in response. UI renders **no donut** (toggle only).
5. **Debounced autosave (~600 ms)** on %/people edits, **toast on each save** via existing
   `useToasts` (`ui/feedback/useToasts`). Matches `saveOpeningHours` pattern.
