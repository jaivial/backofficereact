# Feature 03 — Mesa (open / change table & covers)

**Rail button:** `Mesa` · **Class:** OK/EXT · **Perms:** `pos.sell` / `pos.visit.manage`

## Purpose / UX
Open a dine-in visit on a table with a covers count, or move the current comanda to a
different table number. The keypad can type the table number and covers directly.

## UX behaviour
- No active visit: `Mesa` -> table picker (or keypad table number) + covers -> open visit.
- Active visit: `Mesa` -> "Cambiar mesa" -> pick/keypad new table -> comanda moves, old table frees.
- Covers editable via keypad; reservation prefill sets covers from party size.

## Backend mapping (exists)
- `POST /pos/visits` `{ channel:"DINE_IN", tableId, covers, bookingId? }`.
- `PATCH /pos/visits/{id}` for covers changes.

## Gaps / changes (EXT)
- Confirm `PATCH /pos/visits/{id}` accepts `tableId` change (move table) and rejects
  moving onto an occupied table; if not, extend handler with occupancy validation.

## TDD
- Unit: table-number keypad entry, covers validation (>0).
- Backend: change-table PATCH frees old, occupies new, blocks occupied target.
- Component: open + change-table flows update selected table label.

## E2E (dev)
Open Mesa 1 with 2 covers, add line, `Mesa` -> move to Mesa 3 -> Mesa 1 free, Mesa 3 occupied, lines intact.

## Milestone
Part of **M2** (open) and **M3** (change table).
