# Feature 19 — Dividir comanda (divide bill by amount / guests)

**Rail button:** `Dividir comanda` · **Class:** OK/EXT · **Perms:** `pos.sell` / `pos.checkout`

## Purpose / UX
Divide the bill for payment: split the total evenly by N guests ("a escote"), or by
custom amounts, producing sub-payments that sum to the total. Distinct from
"Separar comanda" (which moves items into separate tickets).

## UX behaviour
- `Dividir comanda` -> choose "dividir entre N" (keypad N) or custom amounts -> shows
  per-person amount -> collect each payment -> checkout when covered.

## Backend mapping (exists / partial)
- Split-payment tender at checkout exists (cash/card/other). Line move/split tickets exist.

## Gaps / changes (OK/EXT)
- v1: pure UI — compute even/custom shares and feed the existing multi-tender checkout,
  as long as tenders sum to the total. If we want to persist per-share records before
  full payment, add optional partial-payment tracking on the ticket (migration + endpoint).

## TDD
- Unit: even-split rounding (last share absorbs remainder), custom-amount validation (sum==total).
- Component: divide-by-N shows per-person amount; feeds checkout tenders.
- Backend: multi-tender checkout sums to total (existing).

## E2E (dev)
Ticket 30€ -> `Dividir comanda` between 3 -> 10€ each -> collect 3 payments -> checkout closes once.

## Milestone
Part of **M2** (UI split) / **M4** if persisted partial payments are added.
