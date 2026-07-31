# Feature 07 — Combinado (combo / combined drink)

**Rail button:** `Combinado` · **Class:** NEW · **Perms:** `pos.sell`

## Purpose / UX
Build a "combinado" (spirit + mixer, e.g. Gin + Tonic) or a combined item priced as a
unit, choosing base + complement modifiers. In hostelería this is a common fast path at
the bar with configurable pricing.

## UX behaviour
- `Combinado` -> modal: pick base spirit, pick mixer/complement(s), qty via keypad ->
  adds a single ticket line labelled "Gin + Tonic" at the combinado price.
- Reuses the shared modifier engine (see feature 20/22): a parent line with children.

## Backend mapping
- None today; line create is single-product only.

## Gaps / changes (NEW — shared modifier schema)
- Migration: `pos_product_modifiers` / `pos_ticket_line_modifiers` (parent line ->
  modifier children with name, priceDeltaCents, sourceProductId?). One schema serves
  Combinado, Suplemento and Pack.
- Extend `POST /pos/tickets/{id}/lines` to accept `modifiers[]`; totals include deltas;
  stock rules deduct base + complements; kitchen/bar routing per component.
- Optional `pos_combos` catalogue for predefined combinados with fixed price.

## TDD
- Backend: line-with-modifiers persists children, totals sum base+deltas, stock deducts
  each mapped component, idempotent.
- Unit (FE): combinado builder state, price preview.
- Component: builder modal add-to-ticket produces one parent line with children.

## E2E (dev)
`Combinado` -> Gin + Tónica -> one line at combinado price -> checkout deducts both components.

## Milestone
Part of **M4**. Depends on shared modifier schema (land first).
