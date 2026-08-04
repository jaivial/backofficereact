# Feature 06 — Borrar comanda (void / cancel order)

**Rail button:** `Borrar comanda` · **Class:** OK · **Perms:** `pos.sell` / `pos.line.void` / `pos.visit.manage`

## Purpose / UX
Void the current ticket (or cancel the whole visit if empty), with a required reason,
after a confirm dialog. Used to discard mistaken comandas before payment.

## UX behaviour
- `Borrar comanda` -> `ConfirmDialog` (danger) requesting reason -> void.
- Empty ticket: `POST /pos/tickets/{id}/void`. Whole visit: `POST /pos/visits/{id}/cancel`.
- Non-empty ticket lines already dispatched to kitchen require line-void reasons.
- After void: register resets, table frees, audit recorded.

## Backend mapping (exists)
- `POST /pos/tickets/{id}/void` (empty open tickets only).
- `POST /pos/tickets/{id}/lines/{lineId}/void` (with reason) for individual lines.
- `POST /pos/visits/{id}/cancel` for the visit.

## Gaps / changes
- None backend. FE: reason capture + confirm; when ticket has lines, void lines first
  (or expose a "borrar toda la comanda" that voids all lines then the ticket/visit).

## TDD
- Unit: guard requires reason; empty vs non-empty routing.
- Component: confirm dialog, cancel path, void dispatch.
- Backend: existing void/cancel tests green; void blocked on non-empty ticket.

## E2E (dev)
Open table, add line, `Borrar comanda` with reason -> ticket voided, table free, audit present.

## Milestone
Part of **M2**.
