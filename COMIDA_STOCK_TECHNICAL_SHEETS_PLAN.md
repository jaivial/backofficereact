# Comida → Stock: Raw vs Manufactured + Technical Sheets

**Status:** Plan — approved by owner, not yet implemented
**Scope:** Link every `/app/comida` product to stock, distinguish raw goods from
manufactured dishes, build a technical-sheet (ficha técnica) create/edit
experience inside the comida item modal, and add configurable margin bands.

**Owner decisions recorded:** §0.1 (all nine answered — no blocking questions remain).

---

## 0. Executive summary

Today `/app/comida` and `/app/stock` are disconnected. A dish can be sold with no
stock consequence, and the stock module's recipes have no relationship to the menu
the guest actually orders from.

This plan introduces one decision per comida item — **Materia Prima** (raw) or
**Elaborado** (manufactured) — and derives all stock behaviour from it:

| Comida item | Sale deducts | Stock representation |
|---|---|---|
| **Materia Prima** (Coke, bottled beer, wine by the bottle) | 1 unit of itself | `stock_items.kind='RAW'`, `deduction_source='SALE'` |
| **Elaborado** (paella, cocktail, cortado) | 1 portion of its own output | technical sheet → `stock_recipes` |

The technical sheet is the bridge: a first-class tenant entity with three subtabs
— Información, Receta, Coste — reachable from the comida modal of **every** food
type including wines.

**Non-negotiable:** the technical sheet writes to the *existing* `stock_recipes` /
`stock_recipe_components` tables. We do **not** create a parallel recipe system.
POS checkout, production, forecasting, costing and `ops-check` already consume
those tables and must keep working unchanged.

### 0.1 Owner decisions (authoritative)

| # | Question | Decision |
|---|---|---|
| **1** | When do raw goods leave stock? | **At production.** The raw good is already consumed once cooked. If the finished portion is never sold or is thrown away, that is **merma** (`WASTE`), not an un-consumption. |
| **2** | May we rebuild `uq_stock_recipe_output`? | **Yes, confirmed.** |
| **3** | Text-to-image (Scenario C)? | **Yes, include it.** Already configured: provider `wavespeed`, `t2iModelSlug='openai/gpt-image-2/text-to-image'`, `i2iModelSlug='openai/gpt-image-2/edit'`, key present, active. |
| **4** | Accept orphan CDN objects? | **Yes, with a nightly 00:00 cron** that lists the Bunny storage zone and deletes any object not referenced by any URL column anywhere in the database. |
| **5** | Sheet reuse across dishes? | **Duplicate, don't share.** A tomato-lasagna sheet is only ever tomato lasagna. Reuse means **"copy this sheet as a starting point"**, then edit a few ingredients. |
| **6** | Allergens on manufactured dishes? | Allergens contributed **by raw products are read-only**. The user may freely **add or disable any others** not contributed by raw products. |
| **7** | Which food types get the toggle? | **All of them, including `vinos`.** Rare, but must be supported. |
| **8** | Permissions? | **Split into fine-grained permissions now**, all granted to `admin` + `root`, so the members area can grant/revoke them later. |
| **9** | Margin bands? | **Use the new §7.4 standard** (verbatim in §8). Plus a new **Configuración** section in `/app/stock` to edit bands **globally and per food category**. |

### 0.1.1 Follow-up decisions (second round)

| # | Question | Decision |
|---|---|---|
| **A** | Sweep safety posture (§4.9) | **Use the most professional option** — i.e. the full guard set: `--dry-run` default, 7 nights observation, 48 h grace window, >50 % abort, private zone excluded, single reviewed column registry, audited in `cdn_object_sweeps`. |
| **B** | Margin-band uniqueness | **Use a new table**, and per-category configuration is required. Implemented in §3.4.1 as `stock_margin_scopes` + `stock_margin_scope_bands`, giving **database-enforced** uniqueness instead of application-level checks. |
| **C** | Generated-column / index rebuilds (`070`, `072`) | **Approved** as specified, with schema-clone dry-run and tested rollback. |

### 0.2 What decision #1 means concretely

```
Kitchen cooks 20 paellas   → PRODUCTION_OUT: rice −3.6 kg, fish −1.8 kg, saffron −4 g
                             PRODUCTION_IN:  "Paella (portion)" +20
Waiter sells 1 paella      → SALE: "Paella (portion)" −1        (raw goods untouched)
3 portions unsold at close → WASTE / OVERPRODUCTION: "Paella (portion)" −3  ← merma
```

Consequences that must be built:
- Stock only moves if the kitchen **records production**. §6.1 covers the daily
  production-recording UX; without it, stock never moves and every number is wrong.
- The waste flow must accept **semi-finished portions**, not just raw goods.
  `stock_movements.waste_reason` already has `OVERPRODUCTION` and `SPOILAGE` — the
  UI must expose them for portion items (§5.6).
- Cost of merma = cost of the *portion* (raw cost + optional labour), which is
  higher than raw cost alone. This is correct and more truthful than discarding
  raw-good value only.

---

## 1. Current state (verified against the live system)

### 1.1 Comida storage is already unified — mostly

| Table | Rows (prod) | Role |
|---|---|---|
| `comida_items` | 108 (all `source_type='platos'`) | **the** live table for platos/bebidas/cafes/postres |
| `VINOS` | 42 | separate legacy table, still authoritative for wine |
| `POSTRES` | 40 | legacy, superseded by `comida_items` |
| `PLATOS` / `BEBIDAS` / `CAFES` | 0 | dead legacy tables |

Relevant `comida_items` columns: `id`, `restaurant_id`, `source_type`, `nombre`,
`tipo`, `categoria`, `category_id`, `precio`, `alergenos_json`, `active`,
`foto_url`, `ai_generating`, `ui_data_id`.

> **Decision:** add new columns to `comida_items` and `VINOS` only. Do not touch
> the three empty legacy tables; do not migrate `POSTRES` in this task.

### 1.2 Stock already has almost everything

- `stock_items` — `kind ENUM('RAW','SEMI_FINISHED','FINISHED','CONSUMABLE')`,
  `deduction_source ENUM('PRODUCTION','SALE','BOTH_MANUAL')`,
  `base_unit ENUM('g','ml','ud')`, `image_url`.
- `stock_item_units` — `factor_to_base`, `is_default_display`, `can_recipe`.
- `stock_recipes` — `output_item_id`, `output_qty_base`, `waste_pct`,
  `instructions TEXT`, `version`; unique active output per tenant.
- `stock_recipe_components` — `stock_item_id`, `sub_recipe_id`, `entered_qty`,
  `entered_unit_id`, `qty_base`, `waste_pct`, `sort_order`.
- `stock_movements` — `type` includes `PRODUCTION_IN/OUT`, `SALE`, `WASTE`;
  `waste_reason` includes `OVERPRODUCTION`, `SPOILAGE`, `PREP_LOSS`. **Decision #1
  needs no new movement types.**
- `stock_item_prices` — append-only `unit_cost_base` history with `effective_at`.
- `stock_margin_bands` — `zone ENUM('RED','AMBER','GREEN','PURPLE')` +
  nullable `category_id`, `uq_stock_margin_band (restaurant_id, category_id, zone)`.
  **Verified 0 rows in production**, and its unique key cannot express per-category
  scopes (MySQL `NULL`s are distinct), so it is **replaced** by two new tables
  in §3.4.1 rather than altered.
- `pos_product_stock_rules` — `pos_product_id` → `stock_item_id` (+ optional
  `stock_recipe_id`), `qty_base_per_sale`.
- `pos_products.source_type ENUM('COMIDA_ITEM','VINO','POSTRE','MENU_DISH','MANUAL')`
  + `source_id` — **the comida↔POS join already exists.**
- 17 `stock.*` permission constants already defined (`backoffice_stock.go:19-35`).

**Gaps:** recipe steps, per-step AI image jobs, comida→recipe link, allergen
derivation, T2I call, scoped margin-band tables + UI, nightly CDN sweep.

### 1.3 Reusable infrastructure

| Need | Existing asset |
|---|---|
| WebSocket hub | `backoffice_comida_ai.go` — `boComidaAIHub`, per-`restaurant_id` rooms, 25 s ping / 70 s read deadline |
| Frontend WS singleton + backoff | `hooks/useComidaAIUnified.ts` — module socket, 6 retries, 3 s→60 s |
| Compress → WebP ≤100 KB (client) | `lib/imageCompressor.ts` → `compressImageToWebP(file, 100)` |
| Normalise → WebP (server) | `specialmenuimage.NormalizeToWebP(ctx, raw, name, ct)` |
| Bunny put / delete / URL | `s.bunnyPut`, `s.bunnyDelete` (`backoffice_branding_logo.go:135`), `s.bunnyPullURL` |
| **WaveSpeed submit + poll** | `s.waveSpeedDo(ctx, method, url, key, body)` and the 3 s poll loop in `callComidaImageEdit` |
| Model URL builder | `aiImageEditURLForModel(base, slug)` → `{base}/api/v3/{slug}` |
| Provider resolution | `s.resolveAIImageProvider(ctx, restaurantID)` → key + baseURL + **`T2IModelSlug`** + `I2IModelSlug` |
| AI config gate | `s.aiImageConfigValid(...)`; `GET /api/admin/comida/ai-image/status` |
| Allergen icons | `MenuDishPreviewCard.tsx` — `/media/images/{gluten,…}.png` (14 EU allergens) |
| Allergen keys/aliases | `@foodId/constants/index.ts` — `CARD_ALLERGENS`, `ALLERGEN_ALIAS_TO_CARD` |
| Margin zone helper | `stockDefaultMarginZone(pct)`, `stockCostMetrics(...)` |
| Nightly cron host | `cmd/ops-check` + `villacarmen-ops-check.timer` (`GET_LOCK`, retention sweep already inside) |
| Shared UI primitives | `bo-panel`, `bo-card`, `bo-btn`, `bo-input`, `Modal`, `SimpleTabs`, `FormField`, `StatusBadge`, `EmptyState`, `InlineAlert` |

> **T2I revised down.** My first estimate called this significant new work. After
> reading `callComidaImageEdit`, the async submit + 3 s poll + output decode
> (URL *or* base64 *or* data-URI) is fully reusable. `callAIImageGenerate` is
> essentially the same function **minus** the `images:[dataURI]` field, pointed at
> `aiImageEditURLForModel(base, cfg.T2IModelSlug)`. Both functions should share one
> private `waveSpeedSubmitAndPoll(ctx, url, key, body)` helper to avoid a second
> copy of the poll loop.

---

## 2. Domain model decisions

### D1 — One flag, on the comida item
`production_type ENUM('RAW','MANUFACTURED') NOT NULL DEFAULT 'RAW'` on
`comida_items` **and** `VINOS` (#7). Not a separate table: exactly one value per
item, always needed when the item is read.

### D2 — Technical sheet ≙ `stock_recipes` row (1:1)
A sheet **is** a `stock_recipes` row plus N `stock_recipe_components`
(ingredients), N `stock_recipe_steps` (new), and a derived allergen set.
`comida_items.stock_recipe_id` → `stock_recipes.id`.

### D3 — Sheets are duplicated, not shared (#5)
`stock_recipe_id` is a plain FK, so the schema *permits* sharing, but the UI's
primary action is **"Duplicar ficha"**: deep-copy recipe + components + steps
(step images copied as new Bunny objects, so deleting one sheet can't break
another), then open the copy for editing.

The picker therefore offers two actions per result:
- **Duplicar y editar** (primary) — the #5 workflow.
- **Vincular directamente** (secondary, with a warning) — for genuinely identical
  items such as a renamed duplicate dish.

`GET /technical-sheets/{id}/usage` returns the linked comida items so the UI can
warn before editing a shared sheet.

### D4 — Every manufactured sheet needs an output `stock_item`
`stock_recipes.output_item_id` is `NOT NULL` with an FK. Creating a sheet
auto-creates, **in the same transaction**:
```
stock_items:      kind='SEMI_FINISHED', base_unit='ud', base_dimension='COUNT',
                  deduction_source='SALE', is_tracked=1,
                  name=<sheet name>, image_url=<comida foto_url>
stock_item_units: code='ud', label='ud', factor_to_base=1,
                  is_default_display=1, can_recipe=1, can_count=1
```
Never leave an orphan item.

### D5 — Raw comida item ≙ `stock_items` row with `kind='RAW'`
`comida_items.stock_item_id` → `stock_items.id` (`kind='RAW'`,
`deduction_source='SALE'`, `base_unit='ud'`). POS deducts 1 unit per sale.

### D6 — Sale deduction stays in POS's existing rules table
One `pos_product_stock_rules` row per comida item:

| production_type | rule points at | `qty_base_per_sale` |
|---|---|---|
| `RAW` | the item's own `stock_item_id` | `1` |
| `MANUFACTURED` | the recipe's `output_item_id` + `stock_recipe_id` | `1` |

Per decision #1, POS never explodes BOMs at checkout — preserving the existing
O(1)-checkout and immutable `pos_ticket_line_stock` invariants.

### D7 — Allergens: derived read-only + free manual layer (#6)
```
final = (derived_from_raw)                       -- read-only, cannot be removed
      ∪ (manual_added   \ derived_from_raw)      -- user may add freely
      \ (manual_disabled ∩ ¬derived_from_raw)    -- user may disable only non-derived
```
- `derived` = recursive union of `stock_items.allergens_json` over the component
  tree (following `sub_recipe_id`), depth-capped at 12 with a visited-set cycle
  guard.
- Stored: `derived_allergens_json` (cache), `manual_allergens_json`
  (`{added:[], disabled:[]}`).
- **A derived allergen can never be removed** — enforced server-side, not only in
  the UI. Food-safety liability.
- Each derived icon exposes its contributing ingredient(s) via
  `title`/`aria-label`.

### D8 — Cost is proportional, computed, honest about gaps
`cost = qty_base × unit_cost_base` (latest `stock_item_prices` at or before now).

> 1 kg flour @ €10 → `unit_cost_base = 0.01 €/g`. Recipe uses 500 g →
> `500 × 0.01 = €5.00`. ✅ the brief's worked example.

- Round only at display (2 dp); never round intermediates.
- Divide by `portions` for per-portion cost.
- Apply component-level and recipe-level `waste_pct`.
- **A component with no price is not €0.** Return `costComplete:false` +
  `missingPrices:[names]`, show "coste incompleto". Same rule as labour cost
  ("unknown is not zero").
- Ingredient cost excludes recoverable input VAT; includes non-recoverable taxes,
  freight and directly attributable acquisition costs (§8.1).

### D9 — Margin bands per §8, configurable globally and per category (#9)
Defaults change from the old plan: **Amber is now 35–40 % (was 33–40)** and
**Green 25–35 % (was 22–33)**. `stockDefaultMarginZone()` must be updated and its
boundary tests rewritten.

| Zone | Food cost % | Interpretation |
|---|---|---|
| 🔴 RED | > 40 % | high ingredient burden — review contribution, recipe, portion, supplier, price |
| 🟠 AMBER | 35–40 % | above common range; acceptable where contribution and demand justify |
| 🟢 GREEN | 25–35 % | broad normal range; evaluate against the category target |
| 🟣 PURPLE | < 25 % | high gross margin — validate customer value; **do not auto-label "overpriced"** |

Bands are **diagnostic indicators, never automatic pricing decisions** (§8.5).
The UI must show contribution margin alongside the percentage and must never
render a verdict from the percentage alone.

Bands live in the new `stock_margin_scopes` + `stock_margin_scope_bands` tables
(§3.4.1), which give **database-enforced** uniqueness per scope and per zone.
Resolution order: comida category → comida type → tenant global → code default
(§8.4). Code defaults are never copied into tenant rows.

### D10 — Draft lifecycle, so discard actually cleans up
Sheets created in the modal start `status='DRAFT'`. On discard: cancel in-flight
image jobs, delete steps/components/recipe, delete the auto-created `stock_items`
row if unreferenced, then `bunnyDelete` every object (§4.7). `ACTIVE` sheets are
`ARCHIVED`, never hard-deleted (production history may reference them).

### D11 — One WebSocket, two concerns (search + image status)
Both ride `/api/admin/comida/technical-sheets/ws` with a `type`-discriminated
protocol, reusing the proven singleton+backoff pattern. REST remains the
hydration source of truth (hard reload returns `generation_status` so skeletons
render immediately); WS is a notification channel only.

---

## 3. Database migrations

### 3.1 `069_comida_production_type_and_stock_link.sql`
Idempotent `information_schema` + prepared-statement style, per
`041_comida_items_ai_generating.sql`.

```sql
ALTER TABLE comida_items
  ADD COLUMN production_type ENUM('RAW','MANUFACTURED') NOT NULL DEFAULT 'RAW',
  ADD COLUMN stock_item_id   BIGINT UNSIGNED NULL,
  ADD COLUMN stock_recipe_id BIGINT UNSIGNED NULL,
  ADD KEY idx_comida_items_production   (restaurant_id, production_type),
  ADD KEY idx_comida_items_stock_item   (restaurant_id, stock_item_id),
  ADD KEY idx_comida_items_stock_recipe (restaurant_id, stock_recipe_id);

ALTER TABLE VINOS                          -- #7
  ADD COLUMN production_type ENUM('RAW','MANUFACTURED') NOT NULL DEFAULT 'RAW',
  ADD COLUMN stock_item_id   BIGINT UNSIGNED NULL,
  ADD COLUMN stock_recipe_id BIGINT UNSIGNED NULL;

ALTER TABLE stock_items
  ADD COLUMN allergens_json JSON NULL;      -- raw source of truth for derivation

ALTER TABLE stock_recipes
  ADD COLUMN status ENUM('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN portions INT NOT NULL DEFAULT 1,
  ADD COLUMN derived_allergens_json JSON NULL,
  ADD COLUMN derived_allergens_at DATETIME NULL,
  ADD COLUMN manual_allergens_json JSON NULL,     -- {added:[], disabled:[]}
  ADD COLUMN copied_from_recipe_id BIGINT UNSIGNED NULL,   -- #5 provenance
  ADD COLUMN draft_owner_user_id INT NULL,
  ADD COLUMN draft_expires_at DATETIME NULL,
  ADD KEY idx_stock_recipes_status (restaurant_id, status, name);
```

**FK type verification (mandatory — the migration-065 lesson).** A `BIGINT`
column referencing an `INT` key crash-looped the backend in production. Verified
on the live schema: `comida_items.id INT`, `VINOS.num INT`,
`stock_items.id BIGINT UNSIGNED`, `stock_recipes.id BIGINT UNSIGNED`,
`restaurants.id INT`, `bo_users.id INT`. The new `stock_item_id` /
`stock_recipe_id` columns are correctly `BIGINT UNSIGNED`. **Re-run
`SHOW CREATE TABLE` for every referenced table before writing the file.**

### 3.2 `070_recipe_output_unique_key_rebuild.sql` (#2, approved)
`uq_stock_recipe_output` keys on the generated column
`active_output_item_id = CASE WHEN is_active=1 THEN output_item_id ELSE NULL END`.
Two DRAFT sheets for the same output would collide. Rebuild:

```sql
ALTER TABLE stock_recipes DROP INDEX uq_stock_recipe_output;
ALTER TABLE stock_recipes DROP COLUMN active_output_item_id;
ALTER TABLE stock_recipes
  ADD COLUMN active_output_item_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN is_active = 1 AND status = 'ACTIVE'
                              THEN output_item_id ELSE NULL END) STORED;
ALTER TABLE stock_recipes
  ADD UNIQUE KEY uq_stock_recipe_output (restaurant_id, active_output_item_id);
```

Isolated in its own migration so a failure is unambiguous and rollback is one
file. Must run **after** `069` (references `status`). `stock_recipes` is
near-empty in production, so this is cheap now and only gets riskier later.
Schema-clone dry-run + tested rollback are mandatory (§7.1).

### 3.3 `071_recipe_steps_and_image_jobs.sql`
```sql
CREATE TABLE IF NOT EXISTS stock_recipe_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    step_no INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(1000) NULL,
    image_object_path VARCHAR(1000) NULL,   -- so discard/replace can bunnyDelete
    generation_status ENUM('NONE','PENDING','RUNNING','READY','FAILED') NOT NULL DEFAULT 'NONE',
    generation_mode ENUM('UPLOAD','AI_ENHANCE','AI_GENERATE') NULL,
    generation_error VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_recipe_steps_tenant_id (restaurant_id, id),
    UNIQUE KEY uq_stock_recipe_step_no (restaurant_id, recipe_id, step_no),
    KEY idx_stock_recipe_steps_recipe (restaurant_id, recipe_id, step_no),
    CONSTRAINT fk_stock_recipe_steps_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_recipe_steps_recipe FOREIGN KEY (restaurant_id, recipe_id) REFERENCES stock_recipes(restaurant_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_stock_recipe_step_no CHECK (step_no > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_recipe_step_image_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    step_id BIGINT UNSIGNED NOT NULL,
    mode ENUM('AI_ENHANCE','AI_GENERATE') NOT NULL,
    status ENUM('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    prompt VARCHAR(2000) NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    provider_request_id VARCHAR(120) NULL,
    result_object_path VARCHAR(1000) NULL,
    error_message VARCHAR(500) NULL,
    actor_user_id INT NOT NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_step_image_job_idem (restaurant_id, idempotency_key),
    KEY idx_step_image_jobs_step (restaurant_id, step_id, status),
    KEY idx_step_image_jobs_stuck (status, started_at),
    CONSTRAINT fk_step_image_jobs_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_step_image_jobs_step FOREIGN KEY (restaurant_id, step_id) REFERENCES stock_recipe_steps(restaurant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
`image_object_path` is stored **in addition to** `image_url` so cleanup can call
`bunnyDelete` — deriving a storage path from a CDN URL is fragile. The job row is
what makes generation survive a hard reload.

### 3.4 `072_cdn_orphan_sweep_and_band_categories.sql` (#4, #9)
```sql
CREATE TABLE IF NOT EXISTS cdn_object_sweeps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    status ENUM('RUNNING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'RUNNING',
    objects_listed INT NOT NULL DEFAULT 0,
    objects_referenced INT NOT NULL DEFAULT 0,
    objects_deleted INT NOT NULL DEFAULT 0,
    objects_skipped INT NOT NULL DEFAULT 0,
    delete_failures INT NOT NULL DEFAULT 0,
    error_message VARCHAR(500) NULL,
    PRIMARY KEY (id),
    KEY idx_cdn_sweeps_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cdn_object_sweep_deletions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sweep_id BIGINT UNSIGNED NOT NULL,
    object_path VARCHAR(1000) NOT NULL,
    size_bytes BIGINT NULL,
    last_modified_at DATETIME NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    error_message VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cdn_sweep_deletions_sweep (sweep_id),
    CONSTRAINT fk_cdn_sweep_deletions_sweep FOREIGN KEY (sweep_id) REFERENCES cdn_object_sweeps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
### 3.4.1 Margin-band scopes: a new table (owner decision — database-enforced)

**Why not `ALTER` the old table.** `stock_margin_bands` uses
`uq_stock_margin_band (restaurant_id, category_id, zone)`. Adding scope columns
cannot yield real uniqueness, because MySQL treats `NULL`s as **distinct** in
unique indexes — so two `GLOBAL` rows (both with `NULL` category/type) would both
be accepted. That forces application-level checks, i.e. a half-enforced key.

**Verified:** `SELECT COUNT(*) FROM stock_margin_bands` → **0 rows in production.**
So the table can be replaced outright, with no data migration and no backfill risk.

The fix is a **scope-reference table** where every scope gets a single
`NOT NULL` discriminator column, making the unique key total:

```sql
-- One row per (tenant, scope target). This is the thing bands hang off.
CREATE TABLE IF NOT EXISTS stock_margin_scopes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    scope_kind ENUM('GLOBAL','COMIDA_TYPE','COMIDA_CATEGORY','STOCK_CATEGORY') NOT NULL,
    -- Discriminator: NEVER NULL, so the unique key below is total.
    --   GLOBAL          -> '*'
    --   COMIDA_TYPE     -> 'platos' | 'bebidas' | 'cafes' | 'vinos' | 'postres'
    --   COMIDA_CATEGORY -> 'platos:12' | 'bebidas:4'   (type-qualified, see note)
    --   STOCK_CATEGORY  -> '7'
    scope_key VARCHAR(64) NOT NULL,
    label VARCHAR(140) NOT NULL,
    target_food_cost_pct DECIMAL(5,2) NULL,   -- §8.4/§8.5 category target
    notes VARCHAR(500) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_margin_scope_tenant_id (restaurant_id, id),
    -- Total uniqueness: no NULLs involved, so MySQL enforces it fully.
    UNIQUE KEY uq_stock_margin_scope (restaurant_id, scope_kind, scope_key),
    KEY idx_stock_margin_scopes_lookup (restaurant_id, is_active, scope_kind),
    CONSTRAINT fk_stock_margin_scopes_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT chk_stock_margin_scope_target
      CHECK (target_food_cost_pct IS NULL
             OR (target_food_cost_pct > 0 AND target_food_cost_pct < 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exactly four zone rows per scope, uniqueness enforced by the DB.
CREATE TABLE IF NOT EXISTS stock_margin_scope_bands (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    scope_id BIGINT UNSIGNED NOT NULL,
    zone ENUM('RED','AMBER','GREEN','PURPLE') NOT NULL,
    min_food_cost_pct DECIMAL(5,2) NULL,   -- NULL = open lower bound (PURPLE)
    max_food_cost_pct DECIMAL(5,2) NULL,   -- NULL = open upper bound (RED)
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_margin_scope_band_tenant_id (restaurant_id, id),
    -- One row per zone per scope. Both columns NOT NULL -> fully enforced.
    UNIQUE KEY uq_stock_margin_scope_band (restaurant_id, scope_id, zone),
    KEY idx_stock_margin_scope_bands_scope (restaurant_id, scope_id, sort_order),
    CONSTRAINT fk_stock_margin_scope_bands_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_margin_scope_bands_scope
      FOREIGN KEY (restaurant_id, scope_id)
      REFERENCES stock_margin_scopes(restaurant_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_stock_margin_scope_band_range
      CHECK ((min_food_cost_pct IS NULL OR (min_food_cost_pct >= 0 AND min_food_cost_pct <= 100))
         AND (max_food_cost_pct IS NULL OR (max_food_cost_pct >= 0 AND max_food_cost_pct <= 100))
         AND (min_food_cost_pct IS NULL OR max_food_cost_pct IS NULL
              OR min_food_cost_pct < max_food_cost_pct))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Retire the unusable old table. Safe: verified 0 rows in production.
DROP TABLE IF EXISTS stock_margin_bands;
```

**What the DB now guarantees on its own** — no application-level uniqueness logic:
- Exactly one scope per `(tenant, kind, key)`; a second `GLOBAL` is rejected,
  because `scope_key='*'` is a real value, not `NULL`.
- Exactly one band row per `(tenant, scope, zone)`.
- `min < max` and both within 0–100, per row.
- Deleting a scope cascades its bands; deleting a tenant cascades everything.

**Why `scope_key` is type-qualified for categories.** Plato and bebida categories
live in **separate tables** (`comida_plato_categories`, `comida_bebida_categories`),
each with its own `INT` auto-increment — so `id=3` exists in both and means
different things. A bare `comida_category_id` would silently conflate them.
Encoding `'platos:3'` vs `'bebidas:3'` makes the reference unambiguous.

**Trade-off, stated honestly.** `scope_key` is a string discriminator, so there is
no FK to the category tables and a deleted category can leave a stale scope. That
is the deliberate price of total DB-enforced uniqueness across heterogeneous
parents — a polymorphic FK is not expressible in MySQL. Mitigations:
- Resolution treats an unresolvable `scope_key` as "scope not found" and falls
  through to the next level, so a stale row can never corrupt a calculation.
- `cmd/ops-check` reports scopes whose `scope_key` no longer resolves.
- The category-delete handler deletes matching scopes in the same transaction.

**Cross-validation that cannot be a DB constraint.** Two rules span rows, so they
stay in the write transaction (this is validation, not uniqueness):
1. The four zones must be contiguous and gap-free (RED.min = AMBER.max, etc.).
2. All four zones must be present when a scope is saved.

Both are enforced by writing **all four zone rows in one transaction** — never
row-by-row — so a scope can never be persisted half-configured.

**Resolution order** (first match wins, per §8.4 "configurable by concept and
menu category"):
```
COMIDA_CATEGORY ('platos:12')  →  COMIDA_TYPE ('platos')  →  GLOBAL ('*')  →  code defaults (§8.4)
```
Code defaults are never copied into tenant rows, so a future change to §8.4
reaches every tenant that has not overridden it.

**Existing code that must be removed in the same step** — dropping the table
breaks compilation, so this is not migration-only work:

| Location | Current | Action |
|---|---|---|
| `backoffice_stock_analytics.go:412` | list bands | replace with scope-aware read |
| `backoffice_stock_analytics.go:460` | `INSERT INTO stock_margin_bands` | delete — superseded by scope `PUT` |
| `backoffice_stock_analytics.go:469` | `UPDATE stock_margin_bands` | delete |
| `backoffice_stock_analytics.go:496` | `DELETE FROM stock_margin_bands` | replace with scope delete |
| `backoffice_stock_analytics.go:553` | costing reads bands | repoint at resolved scope bands |
| `server.go` | `/stock/margin-bands` routes | replace with `/stock/margin-scopes` |
| `StockSettingsPanel.tsx:33,62,68,70` | flat band CRUD + `window.prompt` editing | remove; replaced by `MarginBandsPanel` (§5.7) |

The old panel edits bands through `window.prompt`, which the `/app/stock` UI
refactor already flagged as inconsistent with the shared component system. This
replacement removes the last of those prompts from the settings tab.

### 3.5 Backfill — deliberately conservative
Migrations only set `production_type='RAW'` (column default). They do **not**
auto-create `stock_items` for the 108 comida items + 42 wines, because
category→unit mapping needs human judgement, 150 tracked items with no prices
would flood the stock summary with false "sin coste" rows and destroy `ops-check`
signal, and `deduction_source` is a costing-correctness decision.

Instead: an explicit, reviewable **bulk-link wizard** (§5.5) — preview → confirm →
one transaction. Consistent with the module-wide review-first rule.

---

## 4. Backend

### 4.1 New files
| File | Contents |
|---|---|
| `backoffice_technical_sheets.go` | sheet CRUD, duplicate, subtab payloads, allergen derivation, cost, discard |
| `backoffice_technical_sheets_ws.go` | hub, search protocol, image-status broadcast |
| `backoffice_technical_sheet_images.go` | upload / enhance / generate, worker, Bunny, cleanup |
| `backoffice_comida_stock_link.go` | production_type patch, raw linking, bulk wizard, POS rule sync |
| `backoffice_stock_margin_scopes.go` | scope + band CRUD (all four zones per tx), resolution, defaults (#9) |
| `allergens.go` | canonical allergen list + alias map, shared by backend/frontend |
| `ai_image_t2i.go` | `waveSpeedSubmitAndPoll` + `callAIImageGenerate` (#3) |

### 4.2 REST endpoints
All under `/api/admin`, `requireBOSession`, tenant-scoped by
`a.ActiveRestaurantID`, `restaurant_id` in **every** WHERE clause.

**Sheets**
```
GET    /comida/technical-sheets                ?q=&page=&pageSize=10
POST   /comida/technical-sheets                create DRAFT (+output stock_item, one tx)
POST   /comida/technical-sheets/{id}/duplicate  deep copy incl. step images (#5)
GET    /comida/technical-sheets/{id}
PATCH  /comida/technical-sheets/{id}
GET    /comida/technical-sheets/{id}/usage      which comida items link here (#5)
POST   /comida/technical-sheets/{id}/publish    DRAFT → ACTIVE (needs ≥1 component)
DELETE /comida/technical-sheets/{id}            discard/archive + cleanup (§4.7)
GET    /comida/technical-sheets/{id}/allergens  derived + manual + contributors
PATCH  /comida/technical-sheets/{id}/allergens  manual add/disable only (#6)
GET    /comida/technical-sheets/{id}/cost
```

**Components** — thin wrappers reusing `backoffice_stock_recipes.go` cycle
detection and unit conversion:
```
POST|PATCH|DELETE /comida/technical-sheets/{id}/components[/{componentId}]
```

**Steps**
```
POST|PATCH|DELETE /comida/technical-sheets/{id}/steps[/{stepId}]
POST   /comida/technical-sheets/{id}/steps/reorder            { stepIds: [] }
POST   /comida/technical-sheets/{id}/steps/{stepId}/image           multipart  (A)
POST   /comida/technical-sheets/{id}/steps/{stepId}/image/enhance   multipart  (B)
POST   /comida/technical-sheets/{id}/steps/{stepId}/image/generate  JSON prompt (C)
DELETE /comida/technical-sheets/{id}/steps/{stepId}/image
```

**Comida ↔ stock link**
```
PATCH  /comida/{tipo}/{id}/production-type   { productionType, stockRecipeId?, createStockItem? }
GET    /comida/stock-link/preview
POST   /comida/stock-link/apply              one tx + idempotency key
```

**Margin scopes + bands (#9)** — replaces the old flat band CRUD. A scope is
always written with **all four zones in one transaction**, so it can never be
persisted half-configured:
```
GET    /stock/margin-scopes                 list scopes + their four bands
GET    /stock/margin-scopes/targets         selectable targets (types + categories per type)
PUT    /stock/margin-scopes                 upsert one scope + its 4 bands (one tx)
                                            { scopeKind, scopeKey, label,
                                              targetFoodCostPct?, bands:[4] }
DELETE /stock/margin-scopes/{id}            revert to the next level in the chain
GET    /stock/margin-scopes/resolve         ?comidaType=&comidaCategoryId=
                                            → effective bands + which scope won
GET    /stock/margin-scopes/defaults        the §8.4 code defaults
```
`PUT` (not `POST`/`PATCH`) because a scope's band set is replaced atomically as a
whole — partial updates are what allow gaps. Server-side validation: four zones
present, contiguous, gap-free, ascending, 0–100. `scopeKey` is validated against
the real category/type it names, so `'platos:999'` is rejected.

### 4.3 Permissions (#8) — split now, granted to admin/root
New constants in `backoffice_stock.go`, all defaulted **on** for `root`/`admin`
and off for everyone else, so the members area can grant them later:
```go
stockPermissionSheetsView      = "stock.sheets.view"
stockPermissionSheetsManage    = "stock.sheets.manage"      // name, portions, yield
stockPermissionSheetsPublish   = "stock.sheets.publish"
stockPermissionSheetsDelete    = "stock.sheets.delete"
stockPermissionSheetSteps      = "stock.sheets.steps.manage"   // documentation
stockPermissionSheetImages     = "stock.sheets.images.manage"
stockPermissionSheetImagesAI   = "stock.sheets.images.ai"      // AI spend
comidaPermissionProductionType = "comida.production_type.manage"
```
Ingredients and cost keep the **existing** `stock.recipes.manage` /
`stock.costs.view` gates — they change stock deduction and costing, so they must
not become newly reachable. Band editing uses `stock.settings.manage`.

Registration mirrors the existing `stock_role_permissions` seeding, so the future
members UI needs no backend change.

### 4.4 WebSocket protocol
`GET /api/admin/comida/technical-sheets/ws` — hub cloned from `boComidaAIHub`.

Client → server: `{ "type":"search", "requestId":"uuid", "query":"sofr", "page":1 }`

Server → client:
```json
{ "type":"search_results", "requestId":"uuid", "page":1, "pageSize":10, "total":23,
  "items":[{ "id":5, "name":"Sofrito base", "outputItemName":"Sofrito",
             "portions":4, "componentCount":6, "imageUrl":"…",
             "costPerPortion":1.24, "costComplete":true, "status":"ACTIVE",
             "linkedItemCount":2 }] }
{ "type":"step_image_status", "sheetId":5, "stepId":11, "jobId":77, "status":"RUNNING" }
{ "type":"step_image_ready",  "sheetId":5, "stepId":11, "jobId":77, "imageUrl":"…" }
{ "type":"step_image_failed", "sheetId":5, "stepId":11, "jobId":77, "message":"…" }
```

Hardening (all mandatory):
- Reject unauthenticated upgrades **before** `Upgrade()`.
- **Never trust a `restaurantId` from the payload** — always the session's
  `ActiveRestaurantID`. A tenant id in a WS message is a cross-tenant read waiting
  to happen.
- 150 ms client debounce; server rejects `query` > 80 chars; hard `LIMIT 10`;
  max 10 searches/sec/connection.
- Parameterised `LIKE` with escaped `%` and `_` — the search box is untrusted input.
- Last-write-wins per `requestId`; drop superseded in-flight searches.

### 4.5 Allergen derivation (#6)
```go
func (s *Server) deriveSheetAllergens(ctx, restaurantID, recipeID int64)
    (derived []string, contributors map[string][]string, err error)
func resolveSheetAllergens(derived []string, manual manualAllergens) []string
```
Recursive component walk following `sub_recipe_id`, **depth cap 12 + visited set**
(cycles are demonstrably possible — `backoffice_stock_recipes.go` already guards
them; an unguarded recursive walk would hang a request thread). Normalised through
the shared canonical list in `allergens.go` so backend and frontend cannot drift.
Cached in `derived_allergens_json`; invalidated on component mutation and on any
`stock_items.allergens_json` change. Server rejects any attempt to disable a
derived allergen.

### 4.6 Cost calculation
```go
type sheetCostLine struct {
    StockItemID  int64
    Name         string
    ImageURL     string
    QtyBase      float64
    UnitLabel    string
    EnteredQty   float64
    UnitCostBase float64  // €/base unit
    LineCost     float64  // QtyBase × UnitCostBase, waste applied
    PriceMissing bool
}
type sheetCost struct {
    Lines              []sheetCostLine
    IngredientCost     float64
    LabourCost         float64   // separate line, only if labour_cost_enabled
    DirectVariableCost float64   // §8.3 packaging, commission, fees
    TotalCost          float64
    CostPerPortion     float64
    GrossPrice         float64
    NetPrice           float64
    VatRate            float64
    FoodCostPct        float64
    FoodGrossMarginPct float64   // §8.2
    ItemContribution   float64   // §8.3
    GrossMargin        float64
    Zone               string    // RED | AMBER | GREEN | PURPLE
    TargetFoodCostPct  float64   // resolved category target (#9)
    CostComplete       bool
    MissingPrices      []string
}
```
Reuses `stockCostMetrics()` and the updated `stockMarginZone()` so `/app/stock`
costing and the sheet show identical numbers. Labour stays a **separate line**
(§8.1: blending destroys comparability with ingredient-only benchmarks).

### 4.7 Step images
| Scenario | Entry | Path |
|---|---|---|
| **A. Upload** | `POST …/image` | client-compressed WebP ≤100 KB → `NormalizeToWebP` (defence in depth) → `bunnyPut` → `READY` |
| **B. Enhance** | `…/image/enhance` | job `PENDING` → WS `RUNNING` → `callComidaImageEdit` → `NormalizeToWebP` → `bunnyPut` → WS `ready` |
| **C. Generate** | `…/image/generate` | job → `callAIImageGenerate` (t2i) with a prompt built from the step description → `NormalizeToWebP` → `bunnyPut` → WS `ready` |

Invariants:
- Path `images/comida/technical-sheets/{recipeId}/{stepId}-{unixMilli}.webp` —
  timestamped for cache-busting, matching the existing comida convention.
- B and C require `s.aiImageConfigValid(...)` **and** `stock.sheets.images.ai`;
  otherwise the buttons are hidden and the endpoint returns `{success:false}`.
- Input size cap (`s.openAIInputMaxBytes()`) + MIME allow-list
  (`jpeg|png|webp`), copied from `handleBOComidaImageAI`.
- **Persist status before the side effect**, so a hard reload hydrates from REST
  and renders a skeleton. Provider calls happen after commit, never inside a
  transaction (existing project rule).
- Replacing an image `bunnyDelete`s the previous `image_object_path`.
- Worker uses its **own** `context.WithTimeout`, not the request context — a
  client disconnect must not kill an in-flight generation.
- Worker re-checks `status != 'CANCELLED'` before writing (discard race).
- On failure: `FAILED` + `generation_error` + WS `failed`. Never leave `RUNNING`
  forever; `ops-check` flags jobs `RUNNING` > 15 min.
- **T2I prompt safety:** the step description is user text sent to a paid provider.
  Cap at 2000 chars, strip control characters, and prepend a fixed style preamble
  (mirroring `boComidaPlatosAIPrompt`) so output stays on-brand.

### 4.8 Discard cleanup — ordered for safety
`DELETE /comida/technical-sheets/{id}` when `status='DRAFT'`:
1. `UPDATE …_step_image_jobs SET status='CANCELLED' WHERE status IN ('PENDING','RUNNING')`.
2. Collect every non-null `image_object_path` and `result_object_path`.
3. **Commit the DB deletion** (steps → components → recipe → output `stock_items`
   if unreferenced by any other recipe, POS rule or movement).
4. **Then** `bunnyDelete` each path, best-effort, logged.

DB-before-CDN means a Bunny outage leaves an orphan *object* (harmless, and the
#4 nightly sweep collects it) rather than a phantom *row* the user still sees.

### 4.9 Nightly CDN orphan sweep (#4)
New `cmd/cdn-sweep` + `villacarmen-cdn-sweep.{service,timer}` at
`OnCalendar=*-*-* 00:00:00`, `Persistent=true`, `RandomizedDelaySec=600`,
guarded by `SELECT GET_LOCK('villacarmen:cdn-sweep',0)` — same pattern as
`cmd/ops-check`.

Algorithm:
1. Insert a `cdn_object_sweeps` row (`RUNNING`).
2. List the public storage zone recursively via Bunny's list API
   (`GET https://storage.bunnycdn.com/{zone}/{path}/`) — **a new `bunnyList`
   helper is required; only put/get/delete exist today.**
3. Build the referenced-path set from **every** URL-bearing column. Known today:
   `comida_items.foto_url`/`foto_path`, `VINOS.foto_path`/`ai_generated_img`,
   `POSTRES.foto_url`, `stock_items.image_url`, `stock_recipe_steps.image_url`
   /`image_object_path`, `stock_recipe_step_image_jobs.result_object_path`,
   `group_menu_section_dishes_v2.ai_generated_img`, `menusDeGrupos` preview
   columns, branding logo, member photos.
4. Delete only objects that are **unreferenced AND older than 48 h** — a grace
   window so an in-flight upload whose row isn't committed yet is never deleted.
5. Record every deletion in `cdn_object_sweep_deletions`; finalise the sweep row.

**Safety requirements — this job can destroy customer data:**
- **`--dry-run` is the default.** Real deletion requires `--apply`.
- Ship dry-run only for the first 7 nights; review the log, then enable `--apply`.
- Abort without deleting anything if the referenced set is suspiciously small
  (e.g. > 50 % of listed objects would be deleted, or any reference query errored)
  — a failed query must never be read as "nothing is referenced".
- Never touch the **private** document zone (`BUNNY_PRIVATE_STORAGE_ZONE`); it has
  its own retention policy and legal requirements.
- The reference set must be **generated from a single reviewed registry** of
  URL-bearing columns (a Go slice of `{table, column}`), so adding a future image
  column is one obvious edit — not a silent data-loss bug.

---

## 5. Frontend

### 5.1 Files
```
pages/app/comida/_components/
  ProductionTypeToggle.tsx
  TechnicalSheetPicker/{TechnicalSheetPicker.tsx,useTechnicalSheetSearch.ts}
  TechnicalSheetEditor/
    TechnicalSheetEditor.tsx           # 3 subtabs
    TechnicalSheetInfoTab.tsx          # ingredients + allergens
    TechnicalSheetRecipeTab.tsx        # steps
    TechnicalSheetCostTab.tsx          # cost + sticky total
    StepCard.tsx / StepImageControls.tsx
    useTechnicalSheetDraft.ts
ui/widgets/allergens/AllergenIconList.tsx        # extracted, shared
pages/app/stock/functionalComponents/MarginBandsPanel/  # #9
components/styles/features/comida/technical-sheets.css
```
`AllergenIconList` is **extracted** from the duplicated maps in
`MenuDishPreviewCard.tsx` and `@foodId/constants/index.ts` — same PNGs, same
labels, one component, so sheet allergens look identical to the rest of the app.

### 5.2 Modal flow
```
FoodItemModal / WineModal            ← #7: every food type
├── existing fields
├── ProductionTypeToggle             ← Switch: Materia Prima ⇄ Elaborado
└── if Elaborado:
    └── SimpleTabs
        ├── "Vincular ficha" → TechnicalSheetPicker   (WS search, 10/page)
        └── "Crear ficha"    → TechnicalSheetEditor   (Info | Receta | Coste)
```
Reuses `ui/shadcn/Switch` and `SimpleTabs` (including the `aria-label` fix that
made tabs nameable on mobile). Toggling back to Materia Prima with an unsaved
draft asks for confirmation, then discards via §4.8.

### 5.3 Picker (#5)
- Card grid: 1:1 image, name, output item, portions, component count,
  cost/portion (or "coste incompleto"), `StatusBadge` for DRAFT, and
  "usada por N platos" when `linkedItemCount > 1`.
- Per card: **Duplicar y editar** (primary) and **Vincular directamente**
  (secondary, warns that edits will affect every linked dish).
- Search drives WS; results applied only on matching `requestId`.
- `bo-pager`, 10 rows/page, server-side.
- `EmptyState` + "Crear ficha" CTA on no results.
- WS unavailable → visible degraded notice + REST fallback. A hard WS dependency
  with no fallback makes search unusable behind a proxy that blocks upgrades.

### 5.4 Editor subtabs
**Información** — ingredient list (1:1 `stock_items.image_url`, name, qty + unit;
"simple and minimal"); allergens via `AllergenIconList` with derived ones locked
(lock icon + contributing ingredient in the tooltip) and non-derived ones freely
addable/disableable (#6); add-ingredient row (searchable stock item + qty + unit).

**Receta** — empty → `EmptyState` + `Plus` ("Añadir primer paso"). Each step is a
`StepCard`: 1:1 image left, title + description column right. "Añadir paso" below
each card (insert-after). `StepImageControls` offers Upload always;
Enhance/Generate only when `aiImageStatus.valid` **and** the AI permission is
held. `generation_status ∈ {PENDING,RUNNING}` → skeleton, replaced live by WS and
rendered correctly on hard reload from REST. Reorder via up/down buttons —
**not drag-only**; drag-and-drop alone fails WCAG 2.1.1.

**Coste** — card list with 1:1 image, name and **proportional line cost** (not
unit price). Missing price → amber "sin coste" chip, never €0. Sticky footer
(`position: sticky; bottom: 0`) with total, cost/portion, and — when the item has
a price — food-cost %, contribution margin €, the resolved category target, and
the zone. Zone colours use the AA-verified tokens from the `/app/stock` refactor
(`--bo-on-surface-{danger,warning,success}`, `--bo-accent`). **Colour is never the
only signal** — always paired with the zone name and the numbers (WCAG 1.4.1).
Per §8.5 the UI shows a diagnostic, never a verdict: PURPLE reads *"margen alto —
valida el valor percibido"*, not *"sobreprecio"*.

### 5.5 Bulk-link wizard (`/app/stock`, new "Carta" tab)
Table of all comida items **and wines**: name, type, category, current
`production_type`, linked stock item/recipe, suggested action, and an
"N ingredientes sin coste" counter. Multi-select → set type in bulk → preview what
will be created → confirm. One transaction, idempotency key, full audit. This is
how the 108 items + 42 wines get linked without a blind migration.

### 5.6 Portion waste (merma) — required by decision #1
The existing waste action assumes raw goods. It must also accept
`kind='SEMI_FINISHED'` portion items, with `waste_reason` exposed
(`OVERPRODUCTION` for unsold portions, `SPOILAGE`, `PREP_LOSS`). Cost recorded is
the **portion** cost. Without this, decision #1 has no way to write off unsold
production and theoretical stock drifts upward forever.

### 5.7 Margin bands panel (#9)
New `MarginBandsPanel` in the `/app/stock` **Configuración** tab, backed by the
scoped tables in §3.4.1:
- **Scope selector** (three levels): Global · Tipo de comida
  (platos/bebidas/cafés/vinos/postres) · Categoría de comida. Category options are
  loaded per selected type from `/stock/margin-scopes/targets`, so plato and bebida
  categories can never be confused (they are separate tables — §3.4.1).
- **Inheritance is explicit.** Each scope shows whether it is *configured* or
  *inherited*, and from which level. An unconfigured scope renders the inherited
  values greyed, with "Personalizar" to override and "Volver a heredar" to delete
  the override. Silent inheritance is how users end up mis-reading a dish's zone.
- Four editable zone rows (min %, max %) + optional **target food-cost %** per
  scope (§8.4/§8.5).
- Live preview strip showing which zone a sample percentage lands in, using the
  currently edited values.
- **Saved as a whole**: one `PUT` writes all four zones in a single transaction.
  Client validation (contiguous, ascending, 0–100, gap-free) is a convenience;
  the server re-validates and is authoritative.
- "Restaurar valores por defecto" deletes the override, falling back to §8.4.
- Explanatory note reproducing §8.5: bands are diagnostic indicators, never
  automatic pricing decisions.

---

## 6. Risks and open items

### 6.1 Decision #1 requires production recording — the biggest operational risk
Stock only moves when the kitchen records production. If they don't, raw goods
never decrease and every forecast, cost variance and reorder suggestion is wrong.
Mitigations to build:
- Make production recording a first-class, fast action (recipe + batches + 2 taps),
  reachable from `/app/stock` **and** the KDS.
- `ops-check` warning: items with `deduction_source='PRODUCTION'` that have sales
  of their output but **zero** production movements in the period — the exact
  signature of "nobody is recording production".
- Surface theoretical-vs-actual variance (§8.6) so the gap is visible early.

### 6.2 `VINOS` is a separate table
Every comida change must be mirrored for wine (`production_type`, link columns,
POS `source_type='VINO'`, the picker, the wizard). Not hard, easy to forget —
each checklist item that touches comida must also touch VINOS.

### 6.3 `bunnyList` does not exist
The sweep needs recursive listing; only put/get/delete exist. New helper, with
pagination and a hard object cap per run.

### 6.4 The sweep can delete customer images
Highest-blast-radius item in this plan. Owner chose the **most professional
posture** (decision A), so all guards in §4.9 are mandatory, not optional:
dry-run default, 7-night observation before `--apply`, 48 h grace window,
>50 % deletion-ratio abort, private zone excluded, single reviewed column
registry, every run and deletion audited in `cdn_object_sweeps` /
`cdn_object_sweep_deletions`. **Do not ship `--apply` on day one** (step 28).

### 6.5 Margin-band scope keys are strings, not FKs
Resolved by §3.4.1: the new `stock_margin_scopes` /
`stock_margin_scope_bands` tables give **fully DB-enforced** uniqueness, so no
application-level uniqueness logic is needed.

The accepted residual trade-off is that `scope_key` is a string discriminator
(`'platos:12'`) with no FK to the category tables — unavoidable, since plato and
bebida categories live in separate tables and MySQL cannot express a polymorphic
FK. Consequences and mitigations:
- A deleted category can leave a stale scope. Resolution treats an unresolvable
  `scope_key` as "not found" and falls through, so a stale row can never corrupt a
  calculation.
- The category-delete handler removes matching scopes in the same transaction.
- `cmd/ops-check` reports scopes whose `scope_key` no longer resolves.
- Dropping `stock_margin_bands` is safe only because it is empty in production
  (verified). Re-verify the count on the schema clone before applying.

### 6.6 Cost needs prices to exist
With no `stock_item_prices` rows every sheet shows "coste incompleto". Correct,
but the owner may read it as a bug. The wizard surfaces the missing-price count
and links to price entry.

### 6.7 Band default change is a behaviour change
Amber 33→35 and Green 22→25 will **move existing dishes between zones** in
`/app/stock` costing. Expected, but must be called out in the changelog so it
isn't reported as a regression.

### 6.8 Scope guard
Out of scope: migrating `POSTRES`/legacy tables, recipe version history UI,
nutritional values, multi-language step text, explosion-at-sale mode, PDF export
of sheets, prime-cost dashboard (§8.6 formulas are specified but the dashboard is
a separate task).

---

## 7. Validation

### 7.1 Migration safety — non-negotiable (the 065 lesson)
1. `SHOW CREATE TABLE` for every referenced table; assert exact FK column types.
2. `mysqldump --no-data` live schema → fresh DB → seed `schema_migrations` +
   `restaurants` → run the full migrator → assert **OK**.
3. Verify every new table/column/index/FK/generated column on the clone.
4. Specifically verify `070`: two DRAFT sheets may share an output item; two
   ACTIVE ones may not.
5. Specifically verify `072`: re-assert `stock_margin_bands` is empty **before**
   the `DROP`; then on the clone confirm a second `GLOBAL` scope is rejected by
   `uq_stock_margin_scope`, a duplicate zone is rejected by
   `uq_stock_margin_scope_band`, and `min >= max` is rejected by the CHECK.
6. Only then restart the live backend (migrations auto-apply on boot; a bad
   migration crash-loops the service).
7. Rollback script written **and tested on the clone** before applying.

### 7.2 Backend tests
- Cost: 1 kg flour @ €10, 500 g used → exactly €5.00.
- Missing price → `costComplete:false`, **not** 0.
- Allergen union over a 3-level nested sheet; cycle → error, no hang.
- Manual allergen add succeeds; **disabling a derived allergen is rejected** (#6).
- Duplicate sheet: components + steps copied, step images are **new** objects,
  `copied_from_recipe_id` set (#5).
- Discard: rows gone, Bunny deletes attempted, output item removed, `RUNNING` job
  → `CANCELLED` and the worker writes nothing.
- **New zone boundaries** (#9): 41→RED, 37→AMBER, 30→GREEN, 20→PURPLE, plus the
  exact edges 40/35/25.
- **Scope uniqueness is DB-enforced** (#2): inserting a second `GLOBAL` scope, or a
  second `AMBER` row in one scope, fails at the database — assert the driver error,
  not an application check.
- Scope resolution: comida category → comida type → global → code default; and an
  unresolvable `scope_key` (`'platos:999'`) falls through instead of erroring.
- Scope `PUT` rejects: 3 zones, overlapping ranges, a gap between zones,
  descending bounds, out-of-range percentages, and a `scopeKey` naming a
  non-existent category.
- Deleting a comida category deletes its scope in the same transaction.
- Plato category `id=3` and bebida category `id=3` resolve to **different** scopes
  (`'platos:3'` vs `'bebidas:3'`) — the separate-tables collision case.
- WS search: tenant isolation, `%`/`_` escaping, >80-char rejection, `LIMIT 10`.
- T2I: `callAIImageGenerate` builds `{base}/api/v3/openai/gpt-image-2/text-to-image`
  and shares the poll loop with i2i.
- Sweep: referenced object kept; unreferenced <48 h kept; unreferenced >48 h
  deleted only with `--apply`; >50 % deletion ratio aborts; private zone untouched.
- Real-MySQL: raw sale deducts exactly 1 unit; manufactured sale deducts 1 portion
  and **zero** raw components; production deducts raw components; portion waste
  writes `WASTE`/`OVERPRODUCTION`.

### 7.3 Frontend tests
Vitest: toggle switching, picker pagination + duplicate/link actions, step
add/reorder/delete, skeleton while `RUNNING`, cost rendering incl. missing prices,
zone colours + non-verdict wording, derived allergens locked / manual editable,
margin-band panel validation, and inherited-vs-configured scope rendering.

### 7.4 E2E (real backend, `backoffice-dev.menustudioai.com`)
Following the `e2e/specs/stock` pattern that found 4 real bugs:
- `comida-technical-sheets.spec.ts` — create sheet, add ingredient, add step,
  upload image, publish, link to dish; **zero console/page/network errors**.
- `comida-technical-sheets-ws.spec.ts` — WS search ≤10 results;
  reload-during-generation shows a skeleton then resolves.
- `comida-technical-sheets-a11y.spec.ts` — AA contrast both themes, accessible
  names, 44 px targets, no horizontal overflow, keyboard step reorder.
- `stock-margin-bands.spec.ts` — configure a global scope, override it per comida
  type, then per comida category; verify a dish's zone changes accordingly and that
  "Volver a heredar" restores the parent values.
- All 8 viewport projects, `--workers=1`, web-first assertions (avoid
  `networkidle`, which hangs on WebKit).

### 7.5 Regression guard
`/app/stock`, `/app/pos`, POS checkout, production, forecasting, costing and
`cmd/ops-check` must all still pass — this plan mutates tables they own and changes
the margin-band defaults they read.

Specific to the band replacement (§3.4.1): `/stock/costing` must keep returning a
`zone` for every recipe **after** `stock_margin_bands` is dropped. The existing
`StockSettingsPanel` band tests will fail by design once the flat CRUD is removed
— they must be **replaced**, not deleted, by `MarginBandsPanel` tests. Removing a
test without a replacement silently drops coverage.

---

## 8. Approved food-cost and margin standard (owner-supplied, #9)

Verbatim policy. Supersedes `STOCK_CONTROL_PLAN.md §7.4`.

All sales and margin calculations shall use revenue **excluding VAT** or other
taxes collected on behalf of tax authorities. Ingredient costs shall **exclude
recoverable input VAT**; non-recoverable taxes, freight and other directly
attributable acquisition costs shall be **included**.

### 8.1 Standard recipe cost
Shall include: edible-yield-adjusted ingredient cost; normal trimming and cooking
losses; garnishes, sauces, seasoning and accompaniments; standard portion
quantities; any other food consumed as part of serving the item.
Packaging and channel-related costs shall be recorded **separately** as direct
variable costs.

### 8.2 Food cost percentage
```
food_cost_pct         = standard_recipe_cost / net_selling_price
food_gross_margin_pct = 1 - food_cost_pct
```
Food cost percentage measures ingredient-cost efficiency. It does **not**
represent the final profit margin of the item or the business.

### 8.3 Contribution margin
```
item_contribution            = net_selling_price - standard_recipe_cost - direct_variable_costs
contribution_per_labor_minute = item_contribution / standard_labor_minutes
```
Direct variable costs may include packaging, platform commission, transaction fees
and other costs incurred specifically because the item or order was sold.
`contribution_per_labor_minute` should also be calculated where preparation
capacity is a constraint.

### 8.4 Indicative food-cost bands
Diagnostic indicators, **not** automatic pricing decisions.

| Zone | Food cost % | Interpretation |
|---|---:|---|
| 🔴 Red | Above 40 % | High ingredient burden. Review contribution, recipe, portion, supplier cost and pricing |
| 🟠 Amber | 35–40 % | Above the common restaurant range. Acceptable only where contribution and customer demand justify it |
| 🟢 Green | 25–35 % | Broad normal range for many food items; evaluate against the item's category target |
| 🟣 Purple | Below 25 % | High food gross margin. Validate customer value and sales performance; **do not automatically classify as overpriced** |

Thresholds shall be configurable by restaurant concept and menu category.
Separate targets should normally be maintained for food, alcoholic beverages,
non-alcoholic beverages, desserts, sides and delivery products.

### 8.5 Decision rule
No item shall be approved, rejected or repriced **solely** from food-cost
percentage. Each item shall be evaluated using:
1. Food cost percentage against its category target.
2. Contribution margin per unit.
3. Popularity or units sold.
4. Contribution per labour or preparation minute where relevant.
5. Actual-versus-theoretical cost variance.
6. Customer value, competitive positioning and price acceptance.

A low food-cost percentage indicates high ingredient margin, **not necessarily
overpricing**. A high food-cost percentage may remain acceptable when the item
generates strong contribution, has strategic importance, supports the overall
sales mix or meets the target economics of its category.

### 8.6 Operation-level controls
```
actual_food_cost      = opening_inventory + purchases + transfers_in
                        - transfers_out - closing_inventory
actual_food_cost_pct  = actual_food_cost / net_food_sales
theoretical_food_cost = Σ(recipe_cost_per_item × units_sold)
food_cost_variance    = actual_food_cost - theoretical_food_cost
prime_cost_pct        = (food_and_beverage_COGS + total_labor_cost) / net_sales
```
Management alerts should prioritise unfavourable variance against the approved
budget and theoretical cost rather than reliance on a universal food-cost
percentage.

---

## 9. Implementation order

Each step ends green (lint + types + unit + E2E) before the next starts.

| # | Deliverable |
|---|---|
| 1 | Extract `AllergenIconList` + shared canonical allergen list (`allergens.go`). No behaviour change. |
| 2 | Migration `069` — verify FK types, dry-run on clone, apply, verify. |
| 3 | Migration `070` — unique-key rebuild (#2), isolated, with tested rollback. |
| 4 | Migration `071` — steps + image jobs. |
| 5 | Migration `072` — sweep tables + `stock_margin_scopes` / `stock_margin_scope_bands`; re-verify empty then `DROP stock_margin_bands` (#2). |
| 6 | Update `stockDefaultMarginZone` to §8.4; rewrite boundary tests (#9, #6.7). |
| 7 | Scope CRUD (atomic 4-zone `PUT`) + `targets`/`resolve`/`defaults` endpoints; **remove the old flat band CRUD, routes and `StockSettingsPanel` prompts** (§3.4.1 table); new `MarginBandsPanel` with inheritance UI (#9). |
| 8 | New `stock.sheets.*` permissions, seeded for root/admin (#8). |
| 9 | Sheet CRUD + components + allergen derivation (+ tests). |
| 10 | Duplicate-sheet endpoint + `usage` endpoint (#5). |
| 11 | Cost endpoint incl. contribution margin and category target (§8.2–8.4). |
| 12 | WS hub + search protocol (+ tenant-isolation tests). |
| 13 | Step CRUD + reorder. |
| 14 | Scenario A (upload). |
| 15 | Scenario B (AI enhance) + job rows + WS status + reload hydration. |
| 16 | Refactor `waveSpeedSubmitAndPoll`; add `callAIImageGenerate`; Scenario C (#3). |
| 17 | Draft discard + cleanup + `ops-check` stuck-job check. |
| 18 | `bunnyList` + `cmd/cdn-sweep` + timer, **dry-run only** (#4). |
| 19 | `ProductionTypeToggle` + `production-type` PATCH + POS rule sync (comida **and** VINOS). |
| 20 | `TechnicalSheetPicker` (WS search UI, duplicate/link actions). |
| 21 | Editor — Información (ingredients + allergen locking). |
| 22 | Editor — Receta (steps, images, skeletons). |
| 23 | Editor — Coste (sticky total, zones, contribution). |
| 24 | Portion-waste (merma) support for semi-finished items (§5.6, decision #1). |
| 25 | Production-recording UX + `ops-check` "no production recorded" warning (§6.1). |
| 26 | Bulk-link wizard for 108 comida items + 42 wines. |
| 27 | Full E2E across 8 viewports + regression sweep. |
| 28 | Enable `cdn-sweep --apply` after 7 clean dry-run nights. |
| 29 | Update `ENDPOINTS.md`, `STOCK_CONTROL_PLAN.md` (§7.4 → §8 here), `POS_IMPLEMENTATION_STATUS.md`, `todo.md`, commit tracker. |

Steps 1–5 are prerequisites for everything. Steps 6–18 are backend-first so the UI
is built against real endpoints, never mocks. Step 28 is deliberately last and
gated on observation.
