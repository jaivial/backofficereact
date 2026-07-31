# Plan — Unified "Tipo de producto" editor + all catalogue products as stock

Status: **proposal, not started.** Two questions in §7 need your answer before
step 3 and step 6 can begin.

---

## 1. What you asked for

1. **Every** add/edit dish modal under `/app/comida` (and its subpages) shows a
   **Preparado / Materia prima** switch in the "Tipo de producto" section,
   **always** — for every product type.
2. When **Preparado** is on, the **three subtabs** (Información / Receta /
   Coste) appear **inside the same modal**, so a technical sheet can be built
   without leaving it.
3. **Every existing catalogue product** becomes a stock product. Since no
   technical sheets exist yet, they are **all marked as raw** for now.

---

## 2. What is actually there today (verified, not assumed)

| Product type | Rows | Editor reached by "Editar" | Sheet section today |
|---|---:|---|---|
| platos (incl. **26 ARROZ**) | 108 | detail page `/app/comida/platos/{id}` | yes |
| bebidas | 2 | detail page | yes |
| cafes | 2 | detail page | yes |
| vinos | 42 | detail page (own `WineDetailEditor`) | yes |
| **postres** | **40** | — | **no** |
| **Total** | **194** | | |

Stock link status: **0 of 194** products are linked to a stock item today.

Four facts that shape the plan:

- **"Editar" does not open a modal.** `useFoodTypePage.ts:233` does
  `window.location.assign(...)`; the modal (`FoodItemModal`) is only used for
  **create**. So "the modal" is really *two* surfaces, and both need the
  section. This is the main correction to my earlier work.
- **Arroces are not a separate type.** They are `tipo='ARROZ'` inside `platos`
  (26 rows). No separate handling needed — they come along with platos.
- **`POSTRES` is a separate legacy table** (`NUM`, `DESCRIPCION`, no price)
  that **never received migration 069**, so it has no `production_type` or
  stock-link columns at all. It needs its own migration.
- **`stock_items.sku` is `UNIQUE (restaurant_id, sku)`** — usable to make the
  backfill idempotent and re-runnable.

---

## 3. Design decisions (and why)

### 3.1 One shared section component, four call sites
`ProductionTypeSection` wraps the toggle + subtabs and is rendered by
`FoodItemModal`, `FoodDetailQuickEditor`, `WineDetailEditor` and the new
postres editor. Four copies of this logic would drift; the section is where the
"always visible" guarantee lives, so it is tested once.

### 3.2 Wording: "Preparado / Materia prima"
Your wording replaces my "Elaborado / Comprado". `production_type` values stay
`MANUFACTURED` / `RAW` — the DB enum is not a user-facing string, and renaming
it would be a migration with no benefit.

### 3.3 A sheet needs a saved product — handled, not dodged
The sheet links to a product id, so **create** has no id yet. Rather than hide
the section (what I did before, which contradicts "always"), the switch is
always shown; turning on **Preparado** during create keeps the choice in local
state, and the sheet is created **on first save**, in the same transaction as
the product. The subtabs stay disabled with an explicit line: *"Se creará al
guardar el plato."* Nothing is silently dropped.

### 3.4 Subtabs inside the modal reuse the existing editor
`TechnicalSheetEditor` already renders the three subtabs and is tested. It is
embedded, not reimplemented. A nested modal is avoided — the sheet renders
*inside* the same modal body, which is what you asked for.

### 3.5 Backfill: every product gets a stock item, all `RAW`
- One `stock_item` per product, `kind='RAW'`, `base_unit='ud'`,
  `base_dimension='COUNT'`, `deduction_source='SALE'`, plus its `ud` unit.
- `sku = 'comida:{source_type}:{id}'` / `'vino:{num}'` / `'postre:{num}'`.
  The unique key on `sku` makes the backfill **idempotent**: re-running links
  the same rows instead of creating duplicates.
- `production_type` stays `'RAW'` for all 194 — matching your instruction, and
  honest: we have no sheets, so claiming otherwise would be a lie in the data.
- **No stock movements are created.** Quantities stay at zero until a real
  count. Inventing opening balances would corrupt the ledger.

### 3.6 Backfill is a reviewable command, not a migration
A migration that writes 194 business rows cannot be previewed and crash-loops
the service if it fails. Instead: `cmd/comida-stock-backfill` with **`--dry-run`
as the default**, printing exactly what it would create. Same posture as the CDN
sweep, for the same reason — this touches live catalogue data.

---

## 4. Work plan (TDD; each step red → green → real-stack E2E)

### Step 1 — Migration 074: postres + backfill support
- Add `production_type`, `stock_item_id`, `stock_recipe_id` to `POSTRES`.
- Idempotent and re-runnable; dry-run on a schema clone first, per the rule
  that a failing migration crash-loops the backend.
- **Tests:** extend `schema_constraints_test.go` — columns exist, default is
  `'RAW'`, re-running twice is a no-op.

### Step 2 — Backend: postres in the product endpoints
- `POSTRES` gains the same list fields and `source=postres` in the
  production-type PATCH; sheet-usage `UNION` grows a third branch (with the
  explicit collation, as wine already needed).
- **Tests:** mirror the wine set — list fields, `RAW` default, PATCH, revert
  clears link, **a sheet used by a postre cannot be deleted**.

### Step 3 — Backend: create-product-with-sheet in one transaction
- Product create accepts `productionType`; when `MANUFACTURED`, the sheet and
  its output stock item are created in the **same transaction**.
- **Tests:** a rejected create leaks **zero** stock items and zero recipes
  (the existing D4 rule, extended to this path); `RAW` create makes no sheet.

### Step 4 — Frontend: `ProductionTypeSection`
- Always-visible Preparado / Materia prima switch; subtabs when Preparado.
- **Tests:** switch renders for **every** food type including postres; subtabs
  appear only when Preparado; during create the subtabs are disabled and the
  "se creará al guardar" line is shown; a failed save does not flip the switch.

### Step 5 — Frontend: wire into all four editors
- `FoodItemModal` (create), `FoodDetailQuickEditor` (platos/bebidas/cafes),
  `WineDetailEditor`, new postres editor.
- **Tests:** per editor, the section is present and reflects the saved value.

### Step 6 — Backfill command
- `--dry-run` default, `--apply` to write, summary of created/linked/skipped.
- **Tests:** dry-run writes nothing; apply creates one item per product; a
  second run creates **nothing** (idempotent via `sku`); a product already
  linked is left untouched; no `stock_movements` are ever written.

### Step 7 — Real-stack E2E (`backoffice-dev.menustudioai.com`)
Credentials from `/var/www/newvillacarmen/backend/.env`
(`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`), passed as
`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` with
`BACKOFFICE_URL=https://backoffice-dev.menustudioai.com`.

Specs:
1. For **each** of platos, bebidas, cafes, postres, vinos: open create modal →
   switch is visible → Preparado reveals the three subtabs.
2. Edit an existing product of each type → same, and the value **survives a
   reload** (proves it reached the database, not just local state).
3. Create a Preparado dish end-to-end → sheet exists and is linked.
4. Zero console/page/network errors throughout; each spec restores what it
   changed.

**Note on E2E reliability:** `waitForURL` resolves mid-hydration, so a click can
land on markup React does not own yet. Specs must wait for interactivity (or
retry via `toPass`), as established while fixing the wine spec.

---

## 5. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Backfill creates duplicate stock items | Pollutes the catalogue; hard to unpick | `UNIQUE(restaurant_id, sku)` + dry-run default + idempotency test |
| Backfill invents stock quantities | Corrupts the ledger, which is the source of truth | Creates items only; **no movements** |
| POSTRES has no price column | Cost/margin cannot be computed for postres | Link stock only; surface cost as unavailable rather than as €0 |
| Sheet created on save, then save fails | Orphan sheet + phantom output item | Single transaction; test asserts zero leakage |
| 194 products × POS mapping | POS may deduct unexpectedly once linked | Backfill sets stock links only; POS `pos_product_stock_rules` untouched in this plan |

---

## 6. Out of scope
Opening stock counts; POS deduction rules for the backfilled items; real
technical sheets (that is data entry, per product); renaming the DB enum.

---

## 7. Questions for you

1. **Postres have no price** in the legacy table. Link them to stock anyway
   (my assumption — it makes them countable), or leave postres out until they
   are migrated into `comida_items`?
2. **After the backfill, should POS start deducting** these 194 items on sale?
   My assumption is **no** — links only, deduction stays off until you have
   counted stock, so the first live service does not produce a wall of
   negative-stock anomalies.
