# Stock Control Module — Implementation Plan

> **Status:** Implementation active. Core stock, recipes, forecasting, multimodal
> OCR, costing and operational backoffice are implemented and validated.

## Implementation status

Implemented:

- Phase 1: tenant warehouses/categories/items/units, ledger/materialized levels,
  waste, transfers, targets, reconciliation/rebuild, physical counts, settings,
  fine-grained permissions, CSV/XLSX preview/import and complete operational UI.
- Phase 2: recipe CRUD, recursive nested BOM explosion/cycle detection, production
  preview/confirmation, semi-finished output, deduction-source protection and OCR
  escandallo confirmation.
- Phase 3: manual covers, scenarios, reorder suggestions, cold-start confidence,
  business profile and MiniMax seasonality classification.
- Phase 4: MiniMax M3 native multimodal PDF/JPG/PNG/WebP extraction, pasted text,
  duplicate hashes, review queue, tenant item mapping, supplier aliases and atomic
  invoice confirmation.
- Phase 5: item price history, weighted purchase cost, recursive costing, gross/net
  VAT, overhead, margin-band CRUD, signature-dish protection and persisted AI advice.

Validated with Go tests/vet/build, `pnpm lint:all`, stock/POS Vitest suites,
Vike production build and clean MySQL 8 execution of migrations `060`–`067`.

Remaining external dependencies:

Complete dependency-ordered integration plan: `PENDING_INTEGRATIONS_PLAN.md`.

- Labour costing delivered: effective-dated monthly/hourly compensation, employer
  burden, salary audit, actual fichaje report, recipe member/minute assignments,
  recursive labour costing and production cost snapshots.
- POS sales deduction and automatic covers delivered: idempotent paid-ticket `SALE` movements, immutable mapping snapshots, exception replay, visit-based covers, refunds/returns and table occupancy. Rollout status: `POS_IMPLEMENTATION_STATUS.md`.
- Original OCR file retention foundation delivered using separately configured
  private Bunny storage, access audit and retention cleanup; production credentials
  and retention approval remain pending.
- Scheduled reconciliation foundation delivered through `cmd/ops-check` and systemd
  timer templates; production timer install and alert routing remain pending.
- Actual recipe-production labour allocation delivered from closed fichaje entries;
  pilot workflow validation remains pending.

---

## 0. Confirmed repository facts

Product questions are answered. Repository inspection confirmed:

| # | Question | Why it matters |
|---|---|---|
| # | Confirmed fact | Implementation consequence |
|---|---|---|
| T1 | Go `net/http`/Chi, `database/sql`, embedded SQL migrations | Native handlers and MySQL transactions |
| T2 | React 19/Vike SSR/Tailwind backoffice | Route at `/app/stock`, SSR-safe components |
| T3 | MySQL `DECIMAL` used for stock money/quantities | No float columns in persisted stock accounting |
| T4 | No stock queue/scheduler abstraction | Synchronous OCR; reconciliation endpoints ready for cron |
| T5 | Bunny storage exists but configured pull bucket is public | Supplier originals are not retained |
| T6 | Tenant key is `restaurant_id` | Composite tenant FKs and scoped queries |
| T7 | Section RBAC plus stock-specific permission table | Exact granular stock permission gates |
| T8 | Members/fichaje compensation history added in migration `063` | Effective hourly and actual fichaje labour costs |
| T9 | Recurring feature subscriptions use `recurring_invoices` | `ai_pack` or `stock_ai_pack` plus usage ceilings |
| T10 | No existing stock recipe model | New versioned stock recipes/BOM |
| T11 | MiniMax M3 via Anthropic-compatible messages API; native image/PDF blocks | Multimodal extraction implemented |
| T12 | Spanish UI and `Intl.NumberFormat` conventions | Spanish labels/formatting |

---

## 1. Foundations (apply to every phase)

### 1.1 Multi-tenancy

Every table in this module carries `tenant_id` (restaurant tenant). Non-negotiable rules:

- `tenant_id` on **every** table, including join/detail tables. No inferring the
  tenant through a parent join at query time.
- Every unique constraint is scoped: `UNIQUE (tenant_id, sku)`, never `UNIQUE (sku)`.
- Every index leads with `tenant_id`.
- Tenant filter enforced at the data-access layer (repository base class or ORM
  global scope), **not** hand-written per query. If the DB supports RLS and the
  existing app already uses it, use it — belt and braces.
- A cross-tenant integration test in CI: seed two tenants, assert every list
  endpoint returns only its own rows.

**Per-tenant configuration** lives in `stock_settings` (one row per tenant),
covering: count cadence, warehouse display mode, negative-stock policy, margin
bands, labour costing on/off, VAT rates, seasonality profile, scenario thresholds.
Defaults are applied when the row is absent or a field is null — **never** copy
defaults into tenant rows at creation, or updating a default becomes a migration.

### 1.2 Warehouses (replaces the earlier fixed "locations")

Full CRUD, tenant-scoped, user-defined.

```
Warehouse
  id, tenant_id
  name, code?, type: KITCHEN | BAR | STORAGE | COLD | FREEZER | CELLAR | OTHER
  is_default            -- exactly one per tenant, enforced by partial unique index
  is_active, sort_order, notes
  created_at, updated_at, deleted_at (soft delete)
```

- Every tenant gets one default warehouse ("Almacén principal") auto-created at
  module onboarding, so single-warehouse tenants never think about warehouses.
- **Display mode** (`stock_settings.warehouse_display_mode`):
  - `AGGREGATED` — single flat item list, quantities summed across warehouses.
    Movements go to the default warehouse unless specified.
  - `BY_WAREHOUSE` — warehouse selector/tabs, per-warehouse quantities, transfers enabled.
  User can toggle at any time; it's a view preference, not a data migration,
  because stock is *always* stored per warehouse internally.
- **Deletion:** a warehouse with non-zero stock cannot be deleted — force
  "transfer out or write off first". Soft-delete preserves ledger history.
- **Transfers** are two linked movements (`TRANSFER_OUT` / `TRANSFER_IN`) sharing
  a `transfer_id`, atomic in one transaction.

### 1.3 Permissions — fine-grained from day 1

Today only the restaurant admin gets access, but **endpoints are written against
granular permissions from the start** so opening them to other member roles later
is pure configuration, no code change.

```
stock.view                 stock.items.manage        stock.warehouses.manage
stock.adjust               stock.waste.record        stock.transfer
stock.count.perform        stock.count.close
stock.recipes.view         stock.recipes.manage      stock.production.perform
stock.forecast.view        stock.ocr.upload          stock.ocr.confirm
stock.costs.view           stock.costs.manage        stock.settings.manage
```

Seed a role `RESTAURANT_ADMIN` holding all of them; every endpoint declares its
permission. Notably `stock.costs.view` is separate — purchase prices and margins
are not for everyone, and that separation must exist before other roles are enabled.

### 1.4 AI entitlement gating

AI is a **paid bonus**, gated at two levels:

```
hasAiAccess(tenant, module) =
     plan.global_ai_enabled
  OR plan.module_ai.includes(module)          # e.g. "stock"
```

Implementation rules:
- A single `AiEntitlementService.assertAccess(tenantId, 'stock', feature)` called
  by **every** AI endpoint. No scattered plan checks.
- The module is **fully functional without AI.** Every AI feature has a
  deterministic fallback: manual par levels instead of forecasting, manual entry
  instead of OCR, plain margin tables instead of AI advice. AI adds narrative and
  automation, never core capability.
- UI shows locked AI features as upsell cards rather than hiding them — but never
  blocks the underlying workflow.
- Per-tenant AI usage metering (tokens, cost, calls) recorded per feature for
  billing and abuse control, with a configurable monthly ceiling.
- Model resolved from the tenant's settings page (currently **MiniMax**) through
  a provider abstraction — never hardcode the vendor. Log `model` +
  `model_version` on every AI artefact so results stay explainable after a swap.

### 1.5 Module onboarding wizard

First entry into the module runs a wizard, storing to `stock_settings`:

1. Warehouses — create, or accept the single default.
2. Count cadence — daily / weekly / biweekly / monthly / never (Q5).
3. Display mode — aggregated or by warehouse.
4. Business/seasonality profile — free-text description of the venue, service
   patterns, seasonality (terrace, tourist season, lunch menu vs. à la carte).
   **AI-classified** into a structured seasonality profile (Q14) when entitled;
   otherwise a simple manual form.
5. Item catalogue import — CSV/XLSX, or OCR of existing escandallos (Q7), or manual.
6. Non-tracked items list — seed suggestions (salt, pepper, spices).
7. VAT rates per product category (Q20).
8. Margin bands — accept industry defaults or customise (Q21).
9. Labour costing — on/off (Q23).

All re-editable in **Settings → Stock**. Wizard is resumable and skippable.

---

## 2. Domain model

### 2.1 Units — the core of the design

> **Every item stores stock internally in exactly one canonical base unit.
> All input and display units are conversions layered on top.**

Dimensions: `MASS` → **g**, `VOLUME` → **ml**, `COUNT` → **ud**.
Within-dimension conversions are global constants. Cross-dimension (g↔ml,
density) and abstract-count conversions (1 pepperoni slice = 8 g) are **per item**.

```
StockItem
  id, tenant_id, sku?, name, description?
  category_id, image_url?
  kind: RAW | SEMI_FINISHED | FINISHED | CONSUMABLE
  base_dimension: MASS | VOLUME | COUNT
  base_unit: g | ml | ud
  is_tracked BOOLEAN            -- §2.4 non-tracked list
  deduction_source: PRODUCTION | SALE | BOTH_MANUAL   -- §4.3, prevents double-deduction
  shelf_life_days?, default_supplier_id?
  is_active, created_at, updated_at, deleted_at
  UNIQUE (tenant_id, sku)

StockItemUnit
  id, tenant_id, stock_item_id
  code, label                    -- "kg" / "Saco 25 kg", "loncha" / "Loncha"
  factor_to_base DECIMAL(18,6)   -- 1 of this unit = N base units
  roles: [PURCHASE, DISPLAY, RECIPE, COUNT]
  is_default_purchase, is_default_display
  UNIQUE (tenant_id, stock_item_id, code)

StockLevel                       -- materialised, fast reads
  tenant_id, stock_item_id, warehouse_id  (PK)
  qty_base DECIMAL(18,4)
  avg_unit_cost DECIMAL(18,6)    -- WAC, phase 5
  par_level_base, reorder_point_base DECIMAL(18,4)
  version INT, updated_at

StockMovement                    -- append-only ledger, source of truth
  id, tenant_id, stock_item_id, warehouse_id
  qty_base DECIMAL(18,4)         -- signed
  type: PURCHASE | ADJUSTMENT | PRODUCTION_IN | PRODUCTION_OUT | SALE |
        WASTE | TRANSFER_IN | TRANSFER_OUT | INVENTORY_COUNT | RETURN
  waste_reason?: SPOILAGE | BREAKAGE | OVERPRODUCTION | STAFF_MEAL |
                 CUSTOMER_RETURN | PREP_LOSS | THEFT | OTHER
  entered_qty, entered_unit_id   -- what the human actually typed
  unit_cost?, total_cost?        -- phase 5
  ref_type?, ref_id?, transfer_id?
  idempotency_key UNIQUE
  note?, actor_user_id, occurred_at, created_at
```

**Invariant:** `StockLevel.qty_base == SUM(StockMovement.qty_base)` per
(tenant, item, warehouse). Nightly reconciliation job verifies; a rebuild command
regenerates levels from the ledger. All writes funnel through
`StockService.applyMovement()` in a transaction with `SELECT … FOR UPDATE`.

### 2.2 Worked example — the pizza

```
Harina de trigo    MASS/g    units: g(1,RECIPE) kg(1000,PURCHASE+DISPLAY) saco(25000,PURCHASE)
Huevo              COUNT/ud  units: ud(1,RECIPE+DISPLAY) docena(12,PURCHASE) bandeja(30,PURCHASE)
Pepperoni          MASS/g    units: loncha(8,RECIPE) paquete(500,PURCHASE)
Mozzarella         MASS/g    units: g(1,RECIPE) bolsa(2500,PURCHASE)
```

Recipe "Pizza pepperoni", yield 1 ud:
`500 g harina · 3 ud huevo · 150 g tomate · 3 loncha pepperoni · 50 g queso`
stored as base `500 / 3 / 150 / 24 / 50`, while the UI still shows "3 lonchas"
because `entered_qty + entered_unit_id` are preserved.

Produce 4 pizzas → deduct 2000 g flour, 12 ud eggs, 96 g pepperoni, 200 g cheese.
A 25 kg sack reads as `25000 g` internally, "25 kg" on screen, and the count sheet
can ask for "sacks + loose kg" separately.

### 2.3 Accuracy target (Q11)

**"Roughly right, reliably" — reorder-grade, not gram-perfect COGS accounting.**
Consequences, applied consistently:
- Non-tracked items are legitimate and expected.
- Per-ingredient waste % is an estimate, not a measurement.
- Theoretical vs. physical-count variance is *reported*, not treated as a bug.
- No lot/batch tracking in any planned phase.
- Negative stock is allowed but flagged — blocking service because someone forgot
  to log a delivery is worse than a negative number in a report.

### 2.4 Non-tracked items (Q10)

`is_tracked = false` on the item, managed via a dedicated **Non-tracked list**
screen with full CRUD (add/remove items, bulk move in/out of tracking).
Non-tracked items may still appear in recipes for costing (Phase 5) but are
skipped by stock deduction, and the production preview lists them under
"not deducted (untracked)" so the omission is visible, never silent.

---

## 3. Phase 1 — Stock core

### 3.1 Backend

Migrations: `stock_settings`, `stock_categories`, `stock_items`,
`stock_item_units`, `warehouses`, `stock_levels`, `stock_movements`,
`stock_count_sheets`, `stock_count_lines`.
Indexes lead with `tenant_id`; add `(tenant_id, stock_item_id, warehouse_id,
occurred_at)`, `(tenant_id, type, occurred_at)`, and a text-search index on name.

Services:
- `UnitConversionService.toBase/fromBase` — the single conversion point; the
  highest-value unit-test suite in the module.
- `StockService.applyMovement` / `applyBatch` — transactional, idempotent, emits events.
- `WarehouseService` — CRUD, default enforcement, delete guards, transfers.
- `StockQueryService.list` — cards payload, aggregated or per-warehouse.
- `InventoryCountService` — open sheet, enter observed, close → delta movements.
- `NonTrackedListService` — CRUD + bulk toggle.

API (adapt to house conventions):

```
GET/POST/PATCH/DELETE  /api/stock/warehouses[/:id]
GET/POST/PATCH/DELETE  /api/stock/items[/:id]
GET                    /api/stock/items/:id/movements
POST                   /api/stock/items/:id/movements
POST                   /api/stock/movements/bulk
POST                   /api/stock/transfers
GET                    /api/stock/summary
GET/POST               /api/stock/counts        POST /api/stock/counts/:id/close
GET/POST/DELETE        /api/stock/non-tracked
GET/PATCH              /api/stock/settings
POST                   /api/stock/import        (CSV/XLSX)
GET                    /api/stock/export
```

Filters: `q`, `categoryId[]`, `warehouseId`, `kind[]`, `status`
(ok | below_par | below_reorder | out_of_stock | negative | overstock),
`isTracked`, `sort`, `page`, `pageSize` (max 100).

Summary payload:

```json
{ "itemsTracked": 187, "belowPar": 23, "belowReorder": 9, "outOfStock": 4,
  "negative": 1, "coveragePct": 78.4, "wasteLast7dValue": 84.20,
  "lastCountAt": "…", "nextCountDue": "…" }
```

### 3.2 Frontend

Route `/backoffice/stock`, tabs: **Existencias** · Movimientos · Recuentos ·
Artículos · Almacenes · *Previsión (P3)* · *Escáner (P4)* · *Costes (P5)*.

- **Summary bar** (sticky): coverage progress `current / total needed`, counters,
  waste last 7 days, next count due, warehouse selector (hidden in aggregated mode).
- **Filter bar**: debounced search, category multiselect, status chips, kind chips,
  sort, reset. **State serialised to the URL** — shareable and back-button safe.
- **Card grid** (responsive 1–4 cols):

```
┌──────────────────────────────────────┐
│ [img]  Harina de trigo          ⋮    │
│        Secos · Almacén principal     │
│   12,5 kg / 25 kg necesarios         │
│   ▓▓▓▓▓▓▓░░░░░░  50 %   ⚠ bajo mín. │
│   [ − ]  [ 1 ] [ kg ▾ ]  [ + ]       │
│   Últ. mov.: hace 2 h · Ana          │
└──────────────────────────────────────┘
```

  Inline +/− with unit selector, optimistic update with rollback, client-generated
  idempotency key per adjustment (double-tap on flaky wifi must not double-count).
  Bar colour: red < reorder, amber < par, green ok, blue > 120 % par.
  `⋮` → detail, waste, transfer, edit, history.
- **Detail drawer**: per-warehouse breakdown, paginated movement timeline, unit
  definitions, par/reorder editing, consumption sparkline.
- **Waste dialog**: qty + unit + reason code + optional note (Q6).
- **Bulk mode** and **count-sheet mode** (grid becomes "enter observed qty",
  submitted as one batch).
- Mobile/tablet first — this is used standing in a cold room, not at a desk.

### 3.3 CSV/XLSX importer — ships **with** Phase 1

200 items is too many to type. Column mapping UI, dry-run preview with
per-row validation, error report, idempotent re-import by SKU. Without this,
Phase 1 will not be adopted.

### 3.4 Acceptance criteria

- [ ] Warehouse CRUD; default enforced; deletion blocked with stock present.
- [ ] Both display modes work off the same underlying per-warehouse data.
- [ ] Multi-unit items convert correctly in both directions.
- [ ] Ledger and levels always agree; rebuild-from-ledger reproduces state.
- [ ] Cards paginate/filter/sort; state survives reload.
- [ ] Waste recorded with reason and visible in summary.
- [ ] Non-tracked list CRUD works and excludes items from deduction.
- [ ] Count sheet closes and produces correct delta movements.
- [ ] Cross-tenant isolation test passes.
- [ ] 200-item CSV imports cleanly.

---

## 4. Phase 2 — Technical sheets & recipe consumption

### 4.1 Model

```
Recipe
  id, tenant_id, name, product_id?
  output_item_id, output_qty_base       -- yield
  waste_pct, prep_time_min?, instructions?, allergens?
  version, is_active, effective_from
  source: MANUAL | IMPORTED | OCR      -- Q7

RecipeComponent
  id, tenant_id, recipe_id
  component_type: ITEM | SUB_RECIPE
  stock_item_id? | sub_recipe_id?
  entered_qty, entered_unit_id, qty_base
  waste_pct, is_optional, notes

ProductionOrder
  id, tenant_id, recipe_id, recipe_version
  qty_produced_base, warehouse_id
  status: DRAFT | CONFIRMED | CANCELLED
  produced_at, actor_user_id, total_cost?

ProductionOrderLine                     -- snapshot of actual consumption
  production_order_id, stock_item_id, qty_base
  planned_qty_base, unit_cost?          -- deviation analysis
```

### 4.2 Semi-finished preparations (Q8)

Confirmed in use. Sub-recipes are core, not optional.

```
explode(recipe, qty, depth=0):
  if depth > 5: throw RecipeTooDeep
  scale = qty / recipe.output_qty_base
  for component:
      needed = component.qty_base * scale / (1 - component.waste_pct)
      if SUB_RECIPE:
          if on_hand(sub.output_item) >= needed:  consume directly      # default
          else: shortfall → warn, or cascade if enabled
      else if item.is_tracked: accumulate(item, needed)
      else: record as "not deducted (untracked)"
```

- Cycle detection at recipe save time.
- **Cascade production is opt-in per tenant**, default OFF: consume the prepared
  item, warn when short. Silent cascading is how stock figures become fiction.
- Recipes are versioned; production orders snapshot the version.

### 4.3 Deduction timing (Q9) — the highest-risk rule

`StockItem.deduction_source` makes this explicit and enforceable:

| Item kind | `deduction_source` | Stock drops when |
|---|---|---|
| Raw goods (flour, eggs, pepperoni) | `PRODUCTION` | a manufactured good is elaborated |
| Manufactured goods (pizza, sauces) | `SALE` | sold |
| Direct-sale goods (Coca-Cola, water, coffee, beer) | `SALE` | sold |

**Enforced invariant:** an item is deducted by production *or* by sale, never both.
`applyMovement` rejects a `SALE` movement for a `PRODUCTION`-source item and vice
versa, with a clear error. This is the single biggest correctness risk in the
module and is guarded at the service layer, not by convention.

**Until the POS module exists (Q12):** `SALE` movements have no automatic source.
Phase 2 therefore ships:
- manual "record sales / depletion" entry for sale-deducted items,
- physical counts as the correcting mechanism,
- a documented `SalesConsumptionPort` interface that the future POS module
  implements — idempotent per ticket line — so wiring it up later is one adapter,
  not a refactor.

### 4.4 OCR import of existing escandallos (Q7)

Reuses the Phase 4 pipeline, different schema and target. Upload a photo/PDF/
spreadsheet of an existing technical sheet → extract dish name, yield, ingredient
lines with qty+unit → match ingredients to `StockItem` (fuzzy + alias, with
"create new item" inline) → **human review, always** → save as `Recipe`.
Gated by AI entitlement; manual editor is the always-available fallback.

> Sequencing note: this makes a *slice* of Phase 4's extraction infrastructure a
> Phase 2 dependency. Build the generic `DocumentExtractionService` once, in
> Phase 2, with pluggable schemas (escandallo now, invoice in Phase 4).

### 4.5 Frontend

- Technical sheet editor: component rows with item autocomplete, qty + unit,
  waste %, sub-recipe picker, yield, live cost preview (P5).
- **"Elaborar" modal**: qty → deduction preview (component · needed · available ·
  after · ⚠) → editable overrides (a chef used 4 eggs, not 3; recorded as a
  deviation) → confirm. One atomic transaction: `PRODUCTION_IN` + N `PRODUCTION_OUT`.
- Cancellation writes compensating movements; the ledger is never mutated.
- Recipe detail shows "max producible with current stock" and the limiting ingredient.

---

## 5. Phase 3 — Forecasting, par levels & scenarios

### 5.1 Principle

**All numbers are computed deterministically. The LLM explains, prioritises and
narrates — it never does arithmetic on stock quantities.**

### 5.2 Analytics (no AI, available on every plan)

Nightly job materialises `stock_consumption_daily(tenant, item, warehouse, date,
qty_base, cost)` from movements (`SALE`, `PRODUCTION_OUT`, `WASTE`).
Derived: mean/median daily usage, day-of-week profile, σ, 4/8/12-week trend,
waste %, days of coverage, rotation, dead stock.

### 5.3 Covers signal (Q12) — POS now integrated

Affluence signal, in priority order:
1. Closed dine-in POS visits per service, aggregated once per visit even when bills split.
2. Manual weekly affluence while POS covers mode remains `MANUAL` or `SHADOW`.
3. Fallback — derive a relative index from total consumption volume.

`usage_per_cover = qty / covers` makes scenarios meaningful. POS `LIVE` writes
`stock_affluence_daily.source='POS'`; manual overwrite is blocked and corrections
use append-only cover adjustments.

### 5.4 Cold start (Q13)

| Data available | Behaviour |
|---|---|
| < 2 weeks | Forecasting hidden. Progress UI: "Necesitamos 8 semanas de uso — llevas 1/8." Manual par levels only. |
| 2–4 weeks | Low-confidence estimates, prominently labelled, no auto-ordering. |
| 4–8 weeks | Medium confidence; scenarios enabled with a caution banner. |
| ≥ 8 weeks | Full confidence. |

Confidence badges on every forecast number, never a bare figure.

### 5.5 Scenario engine

```
scenarios = { light: covers_p25, medium: covers_p50, high: covers_p90 }   # tenant-configurable
forecast_qty  = usage_per_cover * expected_covers(scenario, horizon) * (1 + waste_pct)
safety_stock  = z(service_level) * σ_daily * sqrt(lead_time_days)
reorder_point = avg_daily_usage * lead_time_days + safety_stock
order_qty     = ceil_to_purchase_unit(par - on_hand - on_order)
```

`ceil_to_purchase_unit` matters: you cannot order 1.3 sacks of flour. Respect
pack size, `min_order_qty`, and **never recommend more than `shelf_life_days`
of coverage for perishables**.

### 5.6 Seasonality (Q14)

Onboarding free-text description → AI classifies into a structured profile
(seasonal peaks, weekday/weekend pattern, service types, weather sensitivity),
stored as data and **editable by hand**. The forecaster consumes the structured
profile, so AI absence or later disablement never breaks it.

### 5.7 AI layer (entitlement-gated)

`POST /api/stock/forecast/report` — deterministic context (top items by
value/risk, metrics, scenario table, on-hand, anomalies, seasonality profile) →
**structured JSON output** → rendered as cards: weekly summary, prioritised
purchase recommendations with rationale, risk flags (perishable overstock, dead
stock, abnormal waste, theoretical-vs-real divergence), what to watch.
Reports cached and regenerated weekly or on demand. Deterministic numbers always
shown alongside, with a "review before ordering" disclaimer.

### 5.8 Frontend

Tab **Previsión**: scenario selector (flojo / medio / fuerte), horizon, table of
`on hand · forecast · recommended · to order` with editable quantities, shopping
list export (CSV/PDF), AI insight cards (or upsell card if not entitled),
coverage and consumption charts.

---

## 6. Phase 4 — AI OCR for supplier documents

### 6.1 Input reality (Q17, Q18)

Must handle: digital PDFs, photos of printed invoices, **WhatsApp screenshots**,
**handwritten delivery notes**, and **manual text paste**. Handwriting is the
hardest case — set expectations low, always require review, and make manual
correction fast rather than chasing perfect extraction.

### 6.2 Pipeline

```
Upload (PDF / image / screenshot / pasted text)
  → store original (private, tenant-scoped, signed URLs)
  → normalise: PDF→images, deskew, downscale, HEIC→JPEG
  → DocumentScan { status: PENDING }
      ↓ background job
  → Vision LLM → strict JSON + per-field confidence
  → supplier resolution (tax ID, fuzzy name)
  → line matching: supplier_code → SupplierItemAlias → StockItem
                   fallback fuzzy name + unit plausibility
  → unit resolution ("CAJA 6x1L" → 6000 ml)
  → status NEEDS_REVIEW → human review → CONFIRMED
  → batch PURCHASE movements + price capture (P5) + alias learning
```

### 6.3 Model

```
DocumentScan
  id, tenant_id, file_path?, raw_text?, mime, pages, source: UPLOAD | PHOTO | PASTE
  status: PENDING | PROCESSING | NEEDS_REVIEW | CONFIRMED | REJECTED | FAILED
  supplier_id?, invoice_number?, invoice_date?, subtotal?, tax?, total?, currency
  raw_extraction JSONB, model, model_version, tokens, cost, confidence_overall, error?
  UNIQUE (tenant_id, supplier_id, invoice_number)
  UNIQUE (tenant_id, file_hash)

DocumentScanLine
  id, tenant_id, document_scan_id, line_no
  raw_description, raw_code, raw_qty, raw_unit, raw_unit_price, raw_total
  matched_stock_item_id?, matched_unit_id?, qty_base?, unit_cost_base?
  match_confidence, match_source: ALIAS | FUZZY | MANUAL | NEW_ITEM
  status: OK | NEEDS_MATCH | IGNORED

SupplierItemAlias                      -- the learning table, per tenant (Q19)
  tenant_id, supplier_id, supplier_code?, supplier_description
  stock_item_id, stock_item_unit_id, factor_override?
  times_confirmed, last_confirmed_at
  UNIQUE (tenant_id, supplier_id, supplier_code)
```

Supplier codes are consistent per supplier but vary across tenants (Q19) —
hence aliases are strictly tenant-scoped and learn per tenant. After 2–3
confirmed invoices from a supplier, matching should be near-automatic.

### 6.4 Custom tools

`search_stock_items` · `get_supplier_aliases` · `list_item_units` ·
`resolve_unit` · `find_supplier` · `check_duplicate_invoice` · `propose_line_mapping`

Rules:
- The model **never** writes to `stock_movements`; it only produces draft lines.
- All arithmetic (line totals, tax, sums) recomputed in code; mismatches surfaced
  as warnings on the review screen.
- Auto-confirm only when supplier is known **and** all lines matched by alias
  **and** confidence ≥ threshold **and** totals reconcile. Otherwise human review.
- Guardrails: max pages, token ceiling, timeout, retry with backoff, per-tenant
  monthly spend cap; log model/version/tokens/cost per scan.

### 6.5 Frontend

Tab **Escáner**: drag-drop / camera / paste-text, processing queue with statuses,
split-screen review (document preview left, editable lines right), unmatched
lines highlighted with item picker and inline "create item", confidence badges,
"confirm & add to stock" showing a diff of resulting stock changes.

### 6.6 Acceptance

- [ ] Benchmark set of ≥ 30 real documents per format collected **before** building.
- [ ] Targets: ≥ 95 % header accuracy on digital PDFs, ≥ 90 % line qty/price on
      printed docs, ≥ 80 % auto-match after 3 invoices from a supplier.
      Handwriting: best-effort, review mandatory.
- [ ] Duplicate upload never double-adds stock.
- [ ] Every confirmed scan traceable from movement back to source document.

---

## 7. Phase 5 — Costing, margins & pricing AI

### 7.1 Cost model

**Weighted average cost (WAC)**, recomputed on each purchase:
`new_avg = (on_hand*avg + qty_in*price_in) / (on_hand + qty_in)`.
Adequate for reorder-grade accuracy (§2.3); FIFO layers are out of scope.

`StockItemPrice` history `(tenant, item, supplier, date, unit_cost_base, source)`
powers price-evolution charts and "this supplier raised olive oil 18 % this month".

Recipe cost roll-up = Σ `qty_base × cost_base / (1 - waste)`, recursive through
sub-recipes, cached per recipe version, invalidated on price change.

### 7.2 VAT (Q20) — must be handled correctly

Menu prices are stored **VAT-inclusive**. Food-cost % computed against a gross
price is wrong by the VAT rate — enough to flip a dish from green to amber, so
this is a correctness issue, not cosmetics.

```
net_price = gross_price / (1 + vat_rate)
food_cost_pct = food_cost / net_price          -- ALWAYS net
```

`VatRate` table: full CRUD per tenant, assignable per product category
(e.g. ES: 10 % restauración, 21 % alcohol, 4 % reduced). AI-assisted suggestion
of applicable rates from the tenant's country/region — **advisory only, requires
confirmation, never auto-applied**, since tax misconfiguration is expensive.

### 7.3 Metrics

```
food_cost        = recipe cost per portion (+ labour if enabled, §7.6)
food_cost_pct    = food_cost / net_price
gross_margin     = net_price - food_cost
markup_multiple  = net_price / food_cost
contribution     = gross_margin × units_sold
```

### 7.4 Margin bands (Q21)

Industry defaults, applied when no custom band exists; full CRUD per tenant, per
category. Defaults live in code, never copied into tenant rows.

| Zone | Food cost % | ≈ markup | Meaning |
|---|---|---|---|
| **Red** — danger | > 40 % | < 2.5× | Margin too thin: raise price, re-portion, renegotiate, or delist |
| **Amber** — watch | 33–40 % | 2.5–3× | Acceptable but tight |
| **Green** — healthy | 25–33 % | 3–4× | Target band |
| **Purple** — overpriced | < 20–22 % | > 4.5× | Likely above market; risk of poor perceived value |

Category defaults differ: spirits 15–22 %, beer 20–25 %, wine 28–40 %,
food 28–35 %. High-cost proteins tolerate a higher % when absolute margin is large.

> **Encode this nuance:** optimise for **absolute contribution margin (€)**, not
> cost % alone. A 40 %-cost steak at €30 (€18 margin) beats a 20 %-cost salad at
> €8 (€6.40). The UI shows both; the AI prompt must reason on both. Red/purple
> are signals to investigate, not verdicts.
>
> **Action:** re-validate these bands against current published sources at
> implementation time — they are from general industry knowledge, and web
> research was unavailable when this plan was written.

### 7.5 Menu engineering

2×2 on popularity × contribution margin (needs sales data, so realistically
post-POS): ⭐ Star (protect) · 🐴 Plowhorse (cut cost / nudge price) ·
❓ Puzzle (promote, reposition) · 🐕 Dog (rework or remove).

### 7.6 Labour & overhead (Q23) — toggleable

Off by default. When enabled, pulls from the existing **members/salary module**:

```
labour_cost_per_portion = (prep_time_min / 60) * blended_hourly_rate / portions_per_batch
```

- `blended_hourly_rate` derived from the salary module (needs T8 to finalise).
- Optional flat overhead % per recipe or category.
- **Both figures always displayed separately**: ingredient cost, labour cost,
  total cost. Blending them into one opaque number destroys the ability to
  compare against the industry food-cost benchmarks in §7.4, which are
  ingredient-only.

### 7.7 AI advisor (entitlement-gated)

Deterministic metrics computed first, then structured recommendations:

```json
{ "item": "...", "current_state": {...},
  "recommendation": "RAISE_PRICE | REDUCE_PORTION | RENEGOTIATE_SUPPLIER |
                     SUBSTITUTE_INGREDIENT | PROMOTE | REPRICE_DOWN | REMOVE",
  "suggested_price": 13.50, "expected_impact_eur": 240.00,
  "rationale": "...", "confidence": 0.78 }
```

Suggested prices are **recomputed in code** from the target food-cost % and
rounded to psychological price points (€12.95), then VAT-grossed back up for display.

**Delisting advice (Q22):** enabled, with a `is_protected` flag per dish
("signature", "kids' menu", "loss leader") that suppresses REMOVE
recommendations. Removal advice always states the contribution lost and
requires explicit confirmation.

### 7.8 Frontend

Tab **Costes** (behind `stock.costs.view`): escandallo breakdown per dish
(ingredient waterfall + labour if enabled), margin zone badge, price simulator
slider (gross ⇄ net ⇄ cost % ⇄ margin), menu-engineering scatter, ingredient
price-evolution charts, inventory valuation, theoretical-vs-real variance,
AI recommendation cards with accept/dismiss.

---

## 8. Cross-cutting

- **Audit:** every quantity change answers who / when / why / from which document.
  Append-only ledger; corrections are compensating entries.
- **Concurrency:** row locks on `stock_levels`, optimistic `version` for UI
  conflict detection, idempotency keys on all mutating endpoints.
- **Performance targets:** list p95 < 300 ms at 5 000 items/tenant; movement
  insert < 50 ms; nightly aggregation < 2 min/tenant.
- **Observability:** movements/day, negative-stock incidents, OCR success rate,
  AI spend per tenant/feature; alert on reconciliation mismatch.
- **Testing:**
  - unit — conversion matrix (highest value), BOM explosion incl. cycles and
    sub-recipes, WAC, VAT net/gross, zone classification;
  - integration — concurrent adjustments, idempotency, production rollback,
    ledger↔level reconciliation, **cross-tenant isolation**;
  - e2e — create item → stock in → produce → verify deduction → OCR → confirm;
  - AI — golden-set regression for extraction, JSON-schema validity, entitlement gating.
- **Docs:** short staff manual (receiving, counting, recording waste).
  **Adoption is the real risk, not the code.**

---

## 9. Build order within each phase

1. Migrations + domain model + unit conversion (with tests)
2. Service layer + API + permissions + tenant scoping
3. Import/seed tooling
4. Read-only UI (cards, filters, pagination, summary)
5. Mutation UI (+/−, drawer, history)
6. Polish: empty/error states, mobile, i18n, a11y
7. Feature flag → pilot tenant → feedback → iterate

Flags: `stock_control`, `stock_recipes`, `stock_ai_forecast`, `stock_ocr`, `stock_costing`.

---

## 10. Key risks

| Risk | Severity | Mitigation |
|---|---|---|
| Double deduction (production + sale) | **Critical** | `deduction_source` enforced in `applyMovement` (§4.3); POS mapping rejects `PRODUCTION` items per `POS_IMPLEMENTATION_PLAN.md` |
| MiniMax multimodal extraction variance | **Medium** | Strict schema, confidence, duplicate hash and mandatory review |
| POS mapping/cover drift | **High** | Shadow mode, immutable mapping snapshots, exception replay and covers reconciliation |
| Wrong per-item conversions (1 slice = ? g) | High | Conversion wizard, show computed grams on every recipe line |
| VAT applied to gross prices | High | Net/gross helpers centralised + unit-tested (§7.2) |
| Handwritten docs OCR quality | Medium | Expectations set low, review mandatory, fast manual correction |
| Staff don't adopt it | **Highest** | Importer at launch, mobile-first, few clicks, staff manual, pilot first |

---

## 11. Out of scope (future candidates)

Lot/batch + expiry + HACCP traceability · FIFO/LIFO + formal COGS export ·
purchase orders sent to suppliers · supplier price comparison · allergen and
nutrition calculation · in-transit inter-warehouse stock · offline-first mobile
counting · barcode/QR scanning · accounting software integration.
