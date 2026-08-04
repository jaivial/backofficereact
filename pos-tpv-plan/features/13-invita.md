# Feature 13 — Invita (on the house / comp)

**Rail button:** `Invita` · **Class:** EXT · **Perms:** `pos.discount` / `pos.line.void`

## Purpose / UX
Mark selected line(s) or the whole ticket as "invitación" (comped, zero charge) with a
reason and operator attribution, so it is reported separately from discounts and sales.

## UX behaviour
- Select line(s) -> `Invita` -> reason -> those lines become 0-charge, flagged "Invita".
- Whole-ticket invita = 100% comp. Stock still deducts (product consumed); revenue = 0.
- Reported distinctly (comp report), not as a normal discount.

## Backend mapping (exists / partial)
- Ticket discount (100%) and line void with reason exist, but do not model "comp with
  stock consumed and revenue zero, reported as invitación".

## Gaps / changes (EXT)
- Add a line/ticket `comped` flag + `compReason` (migration) and an endpoint
  `POST /pos/tickets/{id}/comp` (or line-level) that zeroes charge but keeps the line and
  stock deduction; surface in reports as invitaciones.

## TDD
- Backend: comp zeroes revenue, keeps stock deduction, records reason+operator, audited.
- Unit (FE): line selection + comp state.
- Component: comp badge on lines, total excludes comped charge.

## E2E (dev)
Add 2 lines, comp one via `Invita` -> that line 0€, total excludes it, still deducts stock; report shows invitación.

## Milestone
Part of **M4**.
