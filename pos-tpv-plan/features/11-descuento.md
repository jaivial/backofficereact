# Feature 11 — Descuento (Dto.) — discount

**Rail button:** `Descuento` · **Class:** OK · **Perms:** `pos.discount`

## Purpose / UX
Apply a discount to the ticket (percentage or fixed amount), entered via keypad, with
a reason. Reflected in totals and VAT recomputation.

## UX behaviour
- `Descuento` -> choose % or € -> keypad amount -> optional reason -> apply.
- Ticket total and tax recompute; discounted state shown on the ticket header.
- Line-level discount optional later; v1 targets ticket-level.

## Backend mapping (exists)
- `POST /pos/tickets/{id}/discount` (`pos.discount`).

## Gaps / changes
- None backend for ticket-level. FE: % vs € toggle, reason capture, keypad integration.
  Confirm whether endpoint accepts percent or absolute cents; adapt UI to its contract.

## TDD
- Unit: %-to-cents conversion, clamp to total, reason required per policy.
- Component: apply discount updates total; remove/change discount.
- Backend: existing discount test green; VAT recompute correct.

## E2E (dev)
Add lines -> `Descuento` 10% -> total reduced correctly -> checkout reflects discount.

## Milestone
Part of **M2**.
