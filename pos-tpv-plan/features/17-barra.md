# Feature 17 — Barra (bar fast sale channel)

**Rail button:** `Barra` · **Class:** EXT · **Perms:** `pos.sell` / `pos.checkout`

## Purpose / UX
Fast counter/bar sale without a table: open a quick ticket, add items, charge
immediately (or park at the bar). Optimised for high-throughput drink sales.

## UX behaviour
- `Barra` -> opens a BAR-channel visit (no table, covers 0) -> add items -> immediate
  `Total`/checkout, or park to a named bar tab.

## Backend mapping (exists / partial)
- `POST /pos/visits` supports `channel` (DINE_IN/TAKEAWAY today). Takeaway already opens
  a tableless visit (`openTakeaway` in `pos.tsx`).

## Gaps / changes (EXT)
- Add `BAR` to the channel enum (migration/validation) or reuse a bar service area;
  ensure reports/covers treat BAR correctly (no covers). Optional named bar tabs reuse
  the parking mechanism (feature 02).

## TDD
- Backend: BAR-channel visit opens without table, checkout closes, covers excluded.
- Unit (FE): bar fast-sale flow state.
- Component: `Barra` opens tableless register; immediate checkout path.

## E2E (dev)
`Barra` -> add 2 drinks -> `Total` cash -> closed; covers report unaffected.

## Milestone
Part of **M3**.
