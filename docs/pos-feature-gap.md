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

1. Fix G7 (SSR crash) — tiny, breaks the whole page.
2. Fix G4 + G5 + G6 (layout/touch/a11y) — small CSS/markup, big usability win
   on the sizes actually used on the floor.
3. Add G1 modifiers — reuses existing tables, unlocks the core sell flow.
4. Add G2 coursing — high value for kitchen, medium effort.
5. G8 fiscal slice (Factura simplificada + series/QR) — compliance, larger.
6. G3 allergens, G9 receipt, G10 packs, G11 PIN, G12 recall, G13 offline.
