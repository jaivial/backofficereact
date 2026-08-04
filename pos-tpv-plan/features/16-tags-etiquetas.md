# Feature 16 — Tags / Etiquetas

**Rail button:** `Tags/Etiquetas` · **Class:** NEW · **Perms:** `pos.sell`

## Purpose / UX
Attach quick tags/labels to a ticket or line — e.g. "para llevar", "sin gluten",
"alérgico", "vip", "cumpleaños" — that travel to the kitchen and reporting.

## UX behaviour
- Select ticket or line -> `Tags` -> pick from tenant-configured tags (or free text) ->
  tags shown as chips on the line/ticket and included in kitchen dispatch text.

## Backend mapping
- None today.

## Gaps / changes (NEW)
- Migration: `pos_tags` (tenant catalogue: name, color) + `pos_ticket_line_tags` /
  `pos_ticket_tags` join tables. Endpoints: `GET/POST /pos/tags` (catalogue, `pos.catalog.manage`),
  `POST /pos/tickets/{id}/tags`, `POST /pos/tickets/{id}/lines/{lineId}/tags` (`pos.sell`).
  Include tags in kitchen dispatch payload.

## TDD
- Backend: tag CRUD, attach/detach on ticket+line, tags surfaced in kitchen queue, gated.
- Unit (FE): tag chip model, add/remove.
- Component: tag picker attaches chips; kitchen text includes tags.

## E2E (dev)
Add line -> tag "sin gluten" -> chip shown -> `Cocina` -> KDS shows the tag.

## Milestone
Part of **M5**.
