# Feature 18 — Comentario (note on line/ticket)

**Rail button:** `Comentario` · **Class:** NEW · **Perms:** `pos.sell`

## Purpose / UX
Add a free-text note to a line or ticket (e.g. "poco hecho", "sin cebolla", "mesa con
niños") that prints on the kitchen ticket and shows on the comanda.

## UX behaviour
- Select line/ticket -> `Comentario` -> text input (with common presets) -> note shown
  under the line and included in the kitchen dispatch.

## Backend mapping
- None today (lines have no note field).

## Gaps / changes (NEW)
- Migration: add `note` (VARCHAR) to `pos_ticket_lines` and optional `pos_tickets.note`.
  Extend `POST/PATCH /pos/tickets/{id}/lines[/{lineId}]` to accept `note`; include in
  kitchen dispatch text. Optional tenant preset notes catalogue.

## TDD
- Backend: note persists on line/ticket, appears in kitchen dispatch, gated.
- Unit (FE): note presets + free text.
- Component: add note renders under line; kitchen text includes note.

## E2E (dev)
Add line -> `Comentario` "sin sal" -> shown on comanda -> `Cocina` -> KDS shows note.

## Milestone
Part of **M5**.
