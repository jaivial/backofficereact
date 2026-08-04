# Feature 04 — Salón (floor / room selector)

**Rail button:** `Salón` · **Class:** EXT · **Perms:** `pos.view`

## Purpose / UX
Show the restaurant floor plan / room, with tables coloured by state (free, occupied,
parked, bill-requested). Tapping a table opens its comanda or a new visit. Supports
multiple rooms/floors (Salón, Terraza, Barra…).

## UX behaviour
- `Salón` -> floor modal/view with rooms tabs; tables rendered from tenant floor config.
- Table color = state derived from `bootstrap.tables[].occupied` + open visits/parked.
- Tap free table -> open flow (feature 03); tap occupied -> restore its comanda.

## Backend mapping (exists / partial)
- `bootstrap.tables[]` includes `occupied`. Restaurant floor/room config exists
  (`/api/admin/config/floors`); existing reservas table map overlays POS visits.

## Gaps / changes (EXT)
- Ensure POS bootstrap returns room/floor grouping + table coordinates (reuse floors
  config). If missing, extend bootstrap to include `rooms[]` with table layout so POS
  can render a real plan rather than a flat list.

## TDD
- Unit: table state mapping (free/occupied/parked).
- Component: rooms tabs switch, table tap dispatches open/restore.
- Backend: bootstrap includes floor layout + occupancy.

## E2E (dev)
Open `Salón`, switch room tab, tap a free table -> open flow; occupied table shows visit.

## Milestone
Part of **M3**.
