# Feature 14 — Empleado (operator / server)

**Rail button:** `Empleado` · **Class:** EXT · **Perms:** `pos.view` (switch) / role-based

## Purpose / UX
Identify or switch the operator/server responsible for the ticket (attribution for
sales-per-employee reports, tips, and accountability), typically via a quick PIN or
member picker without a full logout.

## UX behaviour
- `Empleado` -> member picker / PIN -> sets the active operator on the ticket/visit.
- Operator shown on the ticket header and stored on lines/dispatches for reporting.

## Backend mapping (exists / partial)
- Session user + member roster + `pos.*` permissions exist; sales reports exist.

## Gaps / changes (EXT)
- Add `operatorMemberId` on ticket/line (migration) set at create/patch; optional
  quick-PIN validation endpoint `POST /pos/operator/authenticate` (PIN -> member) so a
  server can be attributed without session switch. Extend sales report grouping by operator.

## TDD
- Backend: operator attribution persists; PIN auth validates member; report groups by operator.
- Unit (FE): operator selection state, PIN entry via keypad.
- Component: operator picker sets header; guarded by permission.

## E2E (dev)
`Empleado` -> select member -> ticket shows operator -> sales report attributes lines to that operator.

## Milestone
Part of **M3**.
