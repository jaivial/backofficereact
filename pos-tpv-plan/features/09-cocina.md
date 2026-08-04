# Feature 09 — Cocina (send to kitchen / KDS)

**Rail button:** `Cocina` · **Class:** OK · **Perms:** `pos.sell` (dispatch) / `pos.kitchen.manage`

## Purpose / UX
Send the pending (not-yet-fired) ticket lines to the kitchen/bar display as an
immutable dispatch. Fired lines are marked as sent; new lines can be fired again.

## UX behaviour
- `Cocina` -> creates a kitchen dispatch for pending lines (idempotencyKey) -> lines
  flip to "enviado a cocina" visual state; KDS queue receives the delta.
- Optional per-station routing already supported via kitchen routes.

## Backend mapping (exists)
- `POST /pos/tickets/{id}/kitchen-dispatches` (idempotencyKey).
- `GET /pos/kitchen/queue`, `POST /pos/kitchen/dispatches/{id}/status`, stations/routes.
- Existing `KitchenDisplay` component renders the queue.

## Gaps / changes
- None backend. FE: fire button, per-line "sent" badges, prevent re-firing already-sent lines.

## TDD
- Unit: pending-vs-sent line partition; idempotency key per fire.
- Component: fire dispatch marks lines sent; disabled when nothing pending.
- Backend: existing kitchen dispatch/queue tests green.

## E2E (dev)
Add lines -> `Cocina` -> lines marked sent -> KDS queue shows dispatch -> mark ready.

## Milestone
Part of **M2**.
