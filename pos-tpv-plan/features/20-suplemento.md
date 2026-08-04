# Feature 20 — Suplemento (supplement / modifier surcharge on a line)

**Rail button:** `Suplemento` · **Class:** NEW · **Perms:** `pos.sell`

## Purpose / UX
Add a paid supplement to a product line (e.g. "+ foie", "+ extra queso", "punto de
cocción premium") that increases the line price and optionally deducts extra stock. Also
used for menú-del-día dishes flagged with a supplement (our catalogue already has
`supplement_enabled`/`supplement_price`).

## UX behaviour
- Select line -> `Suplemento` -> pick supplement(s) (tenant list) or keypad amount ->
  line price increases; supplement shown as a child modifier under the line.

## Backend mapping (exists / partial)
- Carta/menu dishes already carry `supplement_enabled` + `supplement_price`. POS lines
  have no modifier concept yet.

## Gaps / changes (NEW — shared modifier schema)
- Reuse `pos_ticket_line_modifiers` from feature 07. Add a `pos_supplements` tenant
  catalogue (name, priceCents, stockRule?). Extend line create/patch to accept
  supplement modifiers; totals + stock + kitchen text include them.
- Import menú-del-día supplements from existing dish flags where present.

## TDD
- Backend: supplement modifier raises line total, optional stock deduction, gated, idempotent.
- Unit (FE): supplement selection + price preview.
- Component: add supplement shows child modifier + updated line total.

## E2E (dev)
Add dish -> `Suplemento` "+foie 4€" -> line total +4€ -> checkout persists supplement.

## Milestone
Part of **M4**. Depends on shared modifier schema.
