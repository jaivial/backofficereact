# Feature 15 — Separar comanda (split into multiple tickets)

**Rail button:** `Separar comanda` · **Class:** OK · **Perms:** `pos.sell`

## Purpose / UX
Split one comanda into several open tickets within the same visit (separate bills for
the same table) by moving whole/partial lines between tickets, then pay each separately.

## UX behaviour
- `Separar comanda` -> creates a new sibling ticket in the visit -> move selected lines
  (full or partial qty) to it -> switch between tickets -> pay each independently.
- Empty split tickets can be voided.

## Backend mapping (exists)
- `POST /pos/visits/{id}/tickets` creates a sibling ticket.
- `POST /pos/tickets/{id}/lines/{lineId}/move` moves full/partial lines between open tickets.
- `POST /pos/tickets/{id}/void` removes empty split tickets.
- Current `pos.tsx` already has split ticket switching logic (`splitTickets`, `switchTicket`).

## Gaps / changes
- None backend. FE: cleaner split UI (ticket tabs, drag/select lines, partial-qty move via keypad).

## TDD
- Unit: partial-qty move math; empty-ticket void guard.
- Component: create split, move line, switch tickets, totals per ticket.
- Backend: existing split/move tests green.

## E2E (dev)
Open table with 2 lines -> `Separar comanda` -> move one line to ticket B -> pay ticket A, then ticket B.

## Milestone
Part of **M2**.
