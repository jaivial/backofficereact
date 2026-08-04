# Feature 08 — Cliente (attach customer)

**Rail button:** `Cliente` · **Class:** EXT · **Perms:** `pos.view` / `pos.sell`

## Purpose / UX
Attach a customer to the ticket/visit — from an existing reservation/booking or by
entering name + fiscal data (for a nominative invoice). Enables reservation link,
invoice name/NIF and later loyalty.

## UX behaviour
- `Cliente` -> search eligible reservations for today (prefill covers/name) OR manual
  entry (name, NIF/CIF, address for factura).
- Selecting a reservation links the visit; manual entry stores customer fiscal fields on the ticket.

## Backend mapping (exists / partial)
- `GET /pos/reservations/eligible`, `GET /pos/reservations/{bookingId}/visit`, and
  `bookingId` on visit create already link reservations.

## Gaps / changes (EXT)
- Add optional customer fields to ticket/visit (`customerName`, `taxId`, `billingAddress`)
  via migration + `PATCH /pos/visits/{id}` (or ticket). Feed the invoice/factura path.
  No new customer entity required for v1; reuse booking data when linked.

## TDD
- Backend: PATCH stores customer fields; reservation link idempotent (one open visit/booking).
- Unit (FE): reservation search + manual-entry validation (NIF format optional).
- Component: attach-from-reservation and manual-entry flows update ticket header.

## E2E (dev)
`Cliente` -> pick today reservation -> visit shows customer name; or manual name+NIF persists on ticket.

## Milestone
Part of **M5**.
