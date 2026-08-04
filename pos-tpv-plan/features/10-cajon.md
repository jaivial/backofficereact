# Feature 10 — Cajón (open cash drawer)

**Rail button:** `Cajón` · **Class:** NEW/FE · **Perms:** `pos.checkout` / `pos.shift.manage`

## Purpose / UX
Open the physical cash drawer (no-sale) and record the event for audit — e.g. to make
change or during shift reconciliation. Hardware actuation is deferred; we capture the
event now.

## UX behaviour
- `Cajón` -> confirm (optional reason: cambio, arqueo) -> records a NO_SALE drawer event
  tied to the current shift; when a printer/drawer agent exists, also sends the kick pulse.

## Backend mapping
- None today. Cash shifts exist (`/pos/shifts/*`).

## Gaps / changes (NEW)
- Migration: `pos_drawer_events` (shiftId, userId, reason, at). Endpoint
  `POST /pos/shifts/{id}/drawer-open` (or `/pos/drawer/open`) appends the event +
  `pos_audit_events`. Requires an open shift. Physical kick handled later by the printer agent.

## TDD
- Backend: drawer-open requires open shift, records event + audit, permission-gated.
- Component: confirm dialog dispatches drawer-open; disabled without open shift.

## E2E (dev)
Open shift -> `Cajón` with reason -> event recorded; without shift -> blocked with message.

## Milestone
Part of **M5**. Physical drawer kick deferred to printer-agent workstream.
