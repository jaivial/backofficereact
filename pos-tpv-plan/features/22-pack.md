# Feature 22 — Pack (bundle / menú combo)

**Rail button:** `Pack` · **Class:** NEW · **Perms:** `pos.sell` / `pos.catalog.manage`

## Purpose / UX
Sell a predefined bundle at a bundle price (e.g. "Menú del día": primero + segundo +
bebida + postre, or "2 hamburguesas + 2 refrescos"). One tap adds the pack; its
components expand as child lines and route to kitchen individually.

## UX behaviour
- `Pack` -> pick a pack from the tenant pack catalogue -> adds a parent "Pack" line at
  the pack price with component child lines -> components fire to kitchen/bar separately.
- Choice packs (pick 1 of N per slot) prompt component selection before adding.

## Backend mapping
- None today.

## Gaps / changes (NEW — builds on modifier schema)
- Migration: `pos_packs` (name, priceCents, active) + `pos_pack_components`
  (packId, productId, quantity, slotGroup?, choice?). Endpoints `GET/POST /pos/packs`
  (`pos.catalog.manage`). Extend line create to accept `packId` (+ chosen components):
  creates a priced parent line and component child lines; stock deducts each component;
  kitchen routing per component. Reuses `pos_ticket_line_modifiers` for child lines.

## TDD
- Backend: pack add creates parent+children, price = pack price, stock deducts components,
  choice packs validate selection, idempotent, gated.
- Unit (FE): pack builder + choice-slot selection.
- Component: add pack shows parent + component lines; kitchen fires each component.

## E2E (dev)
`Pack` -> "Menú del día" choose primero/segundo/bebida/postre -> one priced parent + child
lines -> `Cocina` routes components -> checkout deducts each component's stock.

## Milestone
Part of **M4**. Depends on shared modifier schema (feature 07).
