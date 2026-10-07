# POS (TPV) — feature gap analysis vs. a good restaurant POS

Scope: `pages/app/pos` (Backoffice APP) and its `/api/admin/pos/*` backend.

## How this was produced

1. Inventory of every control the till exposes (`POSControlRail.RAIL_FEATURES`),
   every POS route mounted in `backend/internal/api/server.go` and every
   `pos_*` table in the dev DB.
2. QA walkthrough at 6 viewports with the `cu` browser and Playwright layout
   probes (see `docs/pos-qa-stories.md`).
3. Gap list below, ordered by value-per-effort. "Measured" means verified in
   code/DB/runtime; "opinion" is the judgement call.

## What the POS already has (verified)

| Area | Present |
| --- | --- |
| Table map | areas filter, 27 tables, capacity, occupancy, restore of open visits, move visit to another table |
| Visits | dine-in, bar, takeaway, park/restore with age, reservations attach, merge visits |
| Comanda | add/remove lines, qty +/− and keypad, void line, split/merge tickets, move line between tickets, divide per head |
| Ticket edits | euro/% discount, surcharge, comp ("invita"), line note, line tags, ticket operator |
| Payments | cash, card, Bizum, transfer; multi-tender split, change, tip, terminal reference, idempotent checkout |
| Cash day | open with float, force open, unclosed-days gate, no-cash-day gate, close with counted cash + discrepancy reason, bulk close of open tables |
| Shifts | open/close, Cierre X / Y preview, drawer open/movements |
| Kitchen | dispatch per route/station, kitchen display queue, dispatch status |
| Stock | OFF/SHADOW/LIVE, product→stock mapping, exceptions, anomalies, replay |
| Reports | sales, covers, card reconciliation, cash summary, accounting CSV exports (SALES_VAT, PAYMENTS, REFUNDS, STOCK) |
| Permissions | 15 `pos.*` permissions incl. void/discount/refund/shift/catalog/kitchen/reports/settings |
| Stock & IVA | per-line VAT rates, IVA breakdown on the ticket, tax in reports |

## Gaps, by priority

### P0 — missing core sell flow

**G1. Modificadores (extra options) are absent.**
The DB already has `pos_modifier_groups`, `pos_modifier_options`,
`pos_product_modifier_groups` and `pos_ticket_line_modifiers` (all empty in dev)
but **no backend code reads or writes them and no POS UI exposes them**. A
waiter cannot add "sin cebolla", "punto de la cocina", "sin lactosa", size
choices or price bumps. For a restaurant this is the single most requested POS
feature after table map.
*Effort:* medium (tables exist; need CRUD routes, a modal on add, and price
recalculation).

**G2. No coursing / "pasos" (fire courses).**
Nothing in the UI lets the waiter hold back the mains and fire the starters
later. Kitchen sees one flat ticket. This is standard in Spanish restaurants
and directly reduces remakes.
*Effort:* medium-high (new `pos_ticket_course` concept + rail action + KDS
grouping).

**G3. No allergens on the ticket.**
The app has an allergens area elsewhere (`internal/api/allergens.go`) but the POS
never surfaces allergens on the product tile, the line or the comanda PDF, so the
kitchen cannot see them.

### P1 — operational gaps that cost money or time

**G4. Layout does not fit the viewport on short screens.**
Measured: at 1024x768, 1180x820 and 1280x720 the document scrolls (913 px,
913 px, 875 px of content vs 768/820/720 px of viewport) and rail actions
(`Cerrar día`, `Cierre X`, `Cierre Y`) sit at y ≈ 990–1112 px, i.e. below the
fold. On a till that means scrolling the page during service.
*Fix:* lock the sell screen to the viewport height (`.pos-sell` should fill the
available height, not `height: 90%` of an auto parent) and let only the ticket
lines / catalog / rail scroll internally.

**G5. Touch targets shrink to 40 px below 820 px of height.**
Measured keypad keys 40 px and rail buttons 40 px at 1024x768, 1180x820 and
1280x720 (44 px elsewhere). 40 px is under the 44 px recommendation.

**G6. Table tiles have a broken accessible name.**
`POSTableTile` renders `<strong>{name}</strong><span>{capacity} plazas</span>`,
so the button announces "14 plazas" for table 1 with 4 seats. Needs an explicit
`aria-label` ("Mesa 1 · 4 plazas").

**G7. SSR crash blanks the sell screen.**
`POSUnclosedDaysModal` and `POSForceOpenConfirmModal` call `createPortal(...,
document.getElementById("bo-portal") || document.body)` during render, so any
day with unsealed previous days throws "document is not defined" while
rendering on the server and the whole sell-screen subtree is missing from the
SSR payload. Same bug class as the toast portal fixed in #525.

### P2 — Spanish fiscal / compliance

**G8. No Verifactu / BAI integration and no fiscal document types.**
Tickets are numbered `TPV-YYYYMMDD-NNNN` through `pos_daily_sequences`, and the
UI honestly labels them "Recibo no fiscal". There is no simplified invoice
(`Factura simplificada`) with `NIF`, no series/block counter, no QR, no
VeriFactu chained record and no export to the AEAT format. For a Spanish
restaurant selling to consumers this is a compliance gap, not a nice-to-have.
*Effort:* high; the cheapest useful slice is a "Factura simplificada" document
with series + number + NIF + QR and a daily sales ledger CSV.

**G9. Receipt printing is `window.print()` of the page.**
The last-receipt banner prints whatever the browser renders, not a proper 80 mm
receipt with the required fields and a stable layout.

### P3 — nice-to-have completeness

**G10. No "packs / combinados"** — tables exist (`pos_packs`,
`pos_pack_components`) but nothing uses them; a waiter cannot ring a fixed
menu as one button.
**G11. No staff PIN / manager approval** — voids and discounts rely on the
logged-in session permissions, so a waiter who can void can void any amount;
classic POS uses a manager PIN for voids over a threshold.
**G12. No quantity recall on the last ticket** — re-adding the previous order
requires re-tapping every tile.
**G13. No offline queue.** Every action is an online call; a network blip blocks
service instead of queuing.

## Priority decision (cheapest high value first)

1. Fix G7 (SSR crash) — tiny, breaks the whole page. **DONE** (#526)
2. Fix G4 + G5 + G6 (layout/touch/a11y) — small CSS/markup, big usability win
   on the sizes actually used on the floor. **DONE** (#526, #527, #530)
3. Add G1 modifiers — reuses existing tables, unlocks the core sell flow.
   **DONE** (backofficereact #528/#529, herorestaurant-backend #388)
4. Add G2 coursing — high value for kitchen, medium effort. **NEXT**
5. G8 fiscal slice (Factura simplificada + series/QR) — compliance, larger.
6. G10 packs. **DONE** (backend #389/#390/#391, backofficereact #532)
7. G12 recall. **DONE** (backend #392, backofficereact #534)
8. G11 staff PIN. **DONE** (backend #393/#400, backofficereact #537/#539)
9. G2 coursing. **DONE** (backend #401/#402/#403, backofficereact #541)
10. G3 allergens, G9 receipt, G13 offline.

---

## G12 — Recall ("traer cuenta"): what shipped

A guest at the same table asks for the same thing and the waiter retypes it.

**Backend** (herorestaurant-backend #392)
- `POST /pos/tickets/{id}/recall` copies a finished ticket's lines onto an open one.
- Prices and modifiers are copied **as sold**, not re-read from the catalogue: the
  guest is owed the dish they had last time even if the recipe or price changed.
- Packs survive: parents keep `pack_id` and components are re-pointed at the
  *copied* parent, so a recalled menú is one paid line with its dishes under it.
- Idempotent (`target:source:index` keys), bounded to 120 lines, refuses an empty
  source, a non-OPEN target and a closed cash day. Two queries to read the source.

**Frontend** (backofficereact #534)
- "Traer cuenta" in the ticket header, hidden on a sealed day or closed ticket.
- Picker of the day's closed tickets (table, number, covers, total), Confirm
  gated until a pick, and an honest empty state instead of a blank box.

**Verified against dev** (measured):

| case | result |
|---|---|
| recall a 26-line ticket with packs | 201, copied 26, total 27830 = source ✅ |
| pack parents preserved | 4 ✅ |
| components nested under the copy | 14 ✅ |
| modifier snapshots copied | 10 ✅ |
| same recall twice | copied 0, total unchanged ✅ |
| unknown source ticket | 404 ✅ |
| target not OPEN (PAID) | 409 ✅ |
| zero source id | 400 ✅ |
| UI: trigger size | 115×44 ✅ |
| UI: Confirm before / after choosing | disabled / enabled ✅ |
| UI: candidates shown | 9 ✅ |
| UI at 390×844 touch | 0 controls <44px, no overflow, no errors ✅ |

---

## G10 — Packs (menú del día): what shipped

`pos_packs`, `pos_pack_components` and `pos_ticket_lines.pack_id/parent_line_id`
have existed since migration 078 with nothing reading or writing them, so a menú
del día could only be rung up plate by plate and the guest's ticket had no way to
say "this is one menu".

**Backend** (herorestaurant-backend #389, #390, #391)
- Ringing up a pack writes the parent line at the pack price and its components
  underneath at zero, so money is counted once and the ticket reads the way the
  guest ordered it.
- One pick per slot, enforced: two picks in a slot would charge the menu price
  for a double portion; a slot with a single option needs no answer.
- Whole menus only — a fractional quantity is rejected instead of rounded.
- Voiding a parent voids its components, so a menu cannot stay in the kitchen
  with nothing to pay for.
- Stock deducts on the components, not the parent.
- Idempotent (component keys derive from the caller's); `PACK_RUNG` audit event.
- Deleting a sold pack deactivates it instead of orphaning paid tickets.

**Frontend** (backofficereact #532)
- "Menús" section on the sell screen; the picker gates Confirm until every slot
  is answered and shows the running total.
- The menu shows on the ticket as one paid line with its dishes indented, not as
  a paid line followed by unexplained 0,00 € plates.

**Verified against dev** (measured):

| case | result |
|---|---|
| slot not answered | 400 ✅ |
| choice outside the slot | 400 ✅ |
| choice from the wrong slot | 400 ✅ |
| fractional quantity (1,5 menús) | 400 ✅ |
| both productId and packId | 400 ✅ |
| pack + price override | 400 ✅ |
| unknown pack | 404 ✅ |
| valid, defaults, qty 1 | parent 2450, components 0 ✅ |
| qty 2 | parent 4900, components qty 2 ✅ |
| no-slot pack, no picks | 201 ✅ |
| retry with the same idempotency key | no duplicate ✅ |
| void the parent | components voided with it ✅ |
| UI: Confirm before choosing | disabled ✅ |
| UI: qty 1 → 2 | 24,50 € → 49,00 € ✅ |
| UI: ticket after adding | one 49,00 € line + 4 nested dishes, no 0,00 € rows ✅ |
| UI: 44px targets | all new controls ≥44px at 390/768/1280/1920 ✅ |

---

## G1 — Modifiers: what shipped

Reuses the schema that was already in the database with zero rows
(`pos_modifier_groups`, `pos_modifier_options`, `pos_product_modifier_groups`,
`pos_ticket_line_modifiers`).

**Backend** (herorestaurant-backend #388)
- `resolvePOSModifiers` validates the picked options against the groups that
  actually apply to the product and enforces each group's min/max select.
  min/max count **distinct** options: "dos milanesas" is one option with
  quantity 2, not two options, and a duplicated request entry folds into the
  same option instead of tripping the max.
- The delta is folded into the line unit price, so quantity/comp/tax maths is
  unchanged; it is still added on top of an explicit price override, so an
  override can never silently drop the chosen extras.
- `GET /pos/bootstrap` ships `productModifiers`; `loadPOSTicket` returns each
  line's snapshotted modifiers.
- Admin CRUD behind `pos.catalog.manage`; unknown group ids rejected.

**Frontend** (backofficereact #528, #529)
- A product with groups opens a picker before it reaches the ticket, with the
  running total next to Confirm.
- 44px targets, +/- stepper capped at 20 units.
- Merge-safe line identity: two identical dishes merge; a "grande + descafeinado"
  never merges into a plain "grande".
- Chosen modifiers render under the line name.

**Verified against dev** (measured, not assumed):

| case | result |
|---|---|
| valid pick, 2x extra (250 each) | unit 1350 → 1850 ✅ |
| required group missing | 400 rejected ✅ |
| 2 options from a max=1 group | 400 rejected ✅ |
| unknown option id | 400 rejected ✅ |
| option on a product with no modifiers | 400 rejected ✅ |
| duplicated option entry | folds to quantity 2 ✅ |
| line qty 2 x (950 + 2x250) | line total 2900 ✅ |
| no modifiers at all (back-compat) | catalog price ✅ |
| modifier qty 5000 (cap 1000) | 400 rejected ✅ |
| UI: required group unmet | Confirm disabled ✅ |
| UI: pick + step to qty 2 | total 13,50 → 18,50 € ✅ |
| UI: target sizes | all 44px ✅ |



---

## G11 — Staff PIN: what shipped

A POS tablet is shared by the whole floor. Before this, every void and discount
landed in the audit trail under whoever opened the session, so a void taken three
hours later could not be traced to a person.

**Backend** (herorestaurant-backend #393, #400)
- `pos_pin_hash` / `pos_pin_set_at` on `restaurant_members`, bcrypt, and a member
  without a PIN keeps working exactly as before.
- `POST /pos/pin` sets **your own** PIN; changing one needs the current one.
- `POST /pos/pin/verify` returns the member's name and says nothing about whether
  a member exists.
- **Line voids are now audited at all** (`LINE_VOID` with reason and approver).
  They were not before — the one action that quietly takes money off a bill was
  the one action you could not ask about afterwards.
- The approval PIN is **verified server-side**; the frontend never sends a name,
  only the PIN, so a tampered label cannot put the wrong person in the trail.

**Frontend** (backofficereact #537, #539)
- `POSPinDialog`: numeric keypad, 52px keys, dots that show how many digits were
  typed and never which ones. Changing a PIN walks current → new automatically.
- `Mi PIN` in the control rail.
- A void asks for a manager's PIN when the signed-in user has none.

**Verified against dev** (measured):

| case | result |
|---|---|
| PIN shorter than 4 / non-numeric | 400, 400 ✅ |
| set a valid PIN, then read status | 200, `hasPin` true ✅ |
| verify correct / wrong PIN | 200 + name / 401 ✅ |
| change a PIN without the current one | 403 ✅ |
| change a PIN with the wrong current one | 403 ✅ |
| change a PIN with the right current one | 200 ✅ |
| 4 wrong PINs then a correct one | 200, counter reset ✅ |
| 5th wrong PIN | 429, terminal locked ✅ |
| correct PIN while locked | 429 (no way through) ✅ |
| void with a wrong approval PIN | 403 and the line stays ACTIVE ✅ |
| void with the right approval PIN | 200, line VOIDED ✅ |
| audit row after an approved void | `{"reason":..., "approvedBy":"Root POS"}` ✅ |
| UI at 1280x800 | step advances, 4 dots, Submit enables, saves, closes ✅ |
| UI at 390x844 touch | 0 controls <44px, keys 81x44, no errors ✅ |

**Four bugs found by running it, all fixed:**
1. `bo_users` has a `name` column, not `first_name`/`last_name` (#396) — every PIN
   set answered 500.
2. `pos_pin_attempts` had an FK to `restaurant_members(id)` but was written with
   `bo_users.id` (#395) — every wrong PIN answered 500.
3. `INTERVAL ? MINUTE` is not a bind parameter (#398) — the throttle row was never
   written, so the lockout was a no-op.
4. The lockout armed on the **first** typo rather than the fifth (#399) — measured
   on dev as "two wrong PINs and the terminal is locked", which would have taken a
   waiter out of service over one mistyped digit.

Plus two found in the browser: the PIN was unhangable for anyone whose staff row
had no `bo_user_id` (#395, most of them), and the change-PIN dialog could never
reach the new-PIN step (#539) — a staff member with a PIN could never change it.


---

## G2 — Coursing (servicios): what shipped

A waiter takes the whole table's order, sends none of it, and fires the first
course when the guests are ready. Before this every dish reached the kitchen the
moment it was rung, so an entrée ordered at the start of service was cooked
twenty minutes early.

**The schema was already half there** — `pos_ticket_lines.course` and an unused
`FIRE` action on the dispatch lines existed, but nothing wrote or read them.

**Backend** (herorestaurant-backend #401, #402, #403)
- `course` is accepted on every line create (plain product, pack parent and pack
  components) and returned on read. Recall carries it, so a recalled menu lands in
  the service it was rung in.
- `POST /pos/tickets/{id}/courses/fire` sends **one** course. It reuses the
  existing dispatch path with a course filter instead of reimplementing routing
  and delta calculation.
- `GET /pos/tickets/{id}/courses` reports each course with how much of it the
  kitchen still has not seen.
- Courses are normalised: `"2"`, `" 2 "`, `"2.º"` and `"curso 2"` are one course,
  and an unset course is course 1 rather than a course nobody can fire.
- The idempotency key is derived from the course **and its current contents**, so
  a double tap cannot fire twice while a dish added after the first fire can
  still be sent.

**Frontend** (backofficereact #541)
- `POSCourseStrip` under the ticket header: pick the course, fire the pending
  ones. One course past the highest in use is always offered.
- The pending count is a badge, not just a colour: "has this gone?" is answered
  without reading the button state.

**Verified against dev** (measured):

| case | result |
|---|---|
| ring a dish into `"2.º"` | 201, stored as course 2 ✅ |
| courses listed with pending counts | `[{1,0},{2,0},{3,1}]` ✅ |
| fire course 1 | 201, `pendingLines` 1 -> 0 ✅ |
| fire course 1 again | 200, nothing re-sent ✅ |
| fire `" curso 2 "` | 201, normalised to course 2 ✅ |
| fire an empty course | treated as course 1 ✅ |
| fire a course with nothing in it | 409 ✅ |
| UI: courses offered | 1, 2, 3, 4 ✅ |
| UI: fire button appears only on courses with pending lines | only course 3 ✅ |
| UI: after firing, the button disappears | ✅ |
| UI at 1280x800 and 390x844 touch | 0 controls <44px, no overflow, no errors ✅ |

**Two bugs found by running it, both fixed:**
1. `GET /courses` answered 500 on every call: `SUM(CASE WHEN COALESCE(SUM(...)))`
   nests an aggregate inside another, which MySQL rejects (#402). The per-line
   sent quantity is now aggregated in a subquery — which also stops a dish routed
   to two stations from being counted twice.
2. **Firing a course told the kitchen to VOID the courses it did not include.**
   `current` was filtered by course but `sent` covered the whole ticket, so
   course 1's lines were missing from one side and present in the other; the
   delta came out negative and the dispatch told the kitchen to cancel dishes
   the waiter never cancelled (#403). Measured on dev: after firing course 2,
   course 1 dropped back to `firedLines: 0` with a VOID for a dish still on the
   bill.
