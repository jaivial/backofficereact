# Feature 02 — Aparcar ticket (park / hold)

**Rail button:** `Aparcar ticket` · **Class:** EXT · **Perms:** `pos.sell` / `pos.visit.manage`

## Purpose / UX
Save the current comanda and clear the register so the operator can serve another
table, then recover it later. In Spanish TPV "aparcar" = keep an open, unpaid ticket
on hold without closing the terminal to it.

## UX behaviour
- Tap `Aparcar` -> current visit/ticket detaches from the register (stays OPEN in DB).
- Parked tickets appear in a "Aparcados" list (and on the floor as occupied) for one-tap recovery.
- Recover via floor tile or the Aparcados list -> `GET /pos/visits/{id}` restores lines.

## Backend mapping (exists)
- Open visits already persist; `GET /pos/visits` lists open visits; `GET /pos/visits/{id}`
  restores tickets/lines. De-facto parking already works.

## Gaps / changes (EXT)
- Add an explicit `parked`/`heldAt` flag (or `status=PARKED` sub-state) on visit or
  ticket so the UI can distinguish "actively serving" vs "parked", plus optional
  `parkedNote`. Migration adds nullable columns; `PATCH /pos/visits/{id}` accepts
  `{ parked: bool, parkedNote? }`. No fiscal impact.

## TDD
- Unit: register clears on park; recover repopulates identical state.
- Backend: PATCH toggles parked flag; visits list surfaces parked ones; permission gate.
- Component: parked list renders, recover loads ticket.

## E2E (dev)
Open table, add lines, `Aparcar`, register empties -> open a second table -> recover
first from Aparcados -> lines intact.

## Milestone
Part of **M3**.
