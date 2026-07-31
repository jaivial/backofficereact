# Feature 21 — Propina (tip)

**Rail button:** `Propina` · **Class:** EXT/NEW · **Perms:** `pos.checkout`

## Purpose / UX
Add a tip to the payment (fixed amount or %) captured at or before checkout, recorded
separately from sales revenue and attributable to the operator, for later distribution.

## UX behaviour
- `Propina` (or in checkout modal) -> % presets or keypad amount -> tip added on top of
  total for tender purposes; stored as tip, not sale revenue.

## Backend mapping
- Payments exist; tip is currently an explicit non-goal in `POS_IMPLEMENTATION_PLAN.md`.

## Gaps / changes (EXT/NEW)
- Add `tipCents` to `pos_payments` (or a `pos_ticket_tips` row) via migration; accept
  `tip` in the checkout payload; exclude tip from net sales/VAT; surface in reports and
  per-operator. Payroll/legal treatment of tips remains out of scope (report only).

## TDD
- Backend: tip stored, excluded from net/VAT, attributed to operator, appears in reports.
- Unit (FE): tip % and amount math on top of total.
- Component: tip entry updates amount-due-with-tip but not sale total.

## E2E (dev)
Ticket 20€ -> `Propina` 10% (2€) -> tender 22€ -> sale net 20€, tip 2€ recorded; report shows tip.

## Milestone
Part of **M4**.
