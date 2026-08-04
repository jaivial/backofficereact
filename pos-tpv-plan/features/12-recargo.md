# Feature 12 — Recargo (surcharge)

**Rail button:** `Recargo` · **Class:** EXT/NEW · **Perms:** `pos.discount` (or new `pos.surcharge`)

## Purpose / UX
Add a surcharge to the ticket (e.g. terrace/holiday/service supplement), percentage or
fixed, opposite sign of a discount. Shown as a positive adjustment on the ticket.

## UX behaviour
- `Recargo` -> % or € -> keypad -> reason -> apply -> total increases; VAT recomputed.

## Backend mapping
- `POST /pos/tickets/{id}/discount` today is deduction-only.

## Gaps / changes (EXT/NEW)
- Preferred: generalise to `POST /pos/tickets/{id}/adjustment` with
  `{ type: DISCOUNT|SURCHARGE, mode: PERCENT|AMOUNT, valueCents/percent, reason }`,
  or add `/surcharge` mirroring discount. Migration: allow signed adjustment rows
  (`pos_ticket_adjustments`) so discount+surcharge coexist. VAT treatment defined with finance.

## TDD
- Backend: surcharge increases total, recomputes VAT, audited, permission-gated, idempotent.
- Unit (FE): surcharge math, coexistence with discount.
- Component: apply surcharge updates total.

## E2E (dev)
Add lines -> `Recargo` 5% -> total increased -> checkout persists surcharge.

## Milestone
Part of **M4**.
