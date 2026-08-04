# Feature 01 — Total (cerrar / cobrar la mesa)

**Rail button:** `Total` · **Class:** OK (wire existing endpoints) · **Perms:** `pos.checkout`

## Purpose / UX
Finish the active table ticket and open the payment/close modal. Shows the ticket
total, tender selection (efectivo / tarjeta / banco / otro), split-payment amounts,
change due, and a "Cobrar y cerrar" confirm. On success the visit closes and the
table frees on the floor.

## UX behaviour
- Tap `Total` -> `POSCheckoutModal` opens with total, quick-cash keys (exact/5/10/20),
  cash/card inputs, computed change, and card terminal reference field when needed.
- Blocks close if the ticket is empty or already closed; shows validation inline.
- After success: toast "Venta completada", print stub, reset register to floor.

## Backend mapping (exists)
- `POST /api/admin/pos/tickets/{id}/checkout` (idempotencyKey) -> stock + close.
- `POST /api/admin/pos/visits/{id}/close` for multi-ticket visit close.
- Payments recorded through checkout body (cash/card/bank/other split; card requires terminal ref).
- `stockStatus`, `visitClosed` returned; partial-stock handled by exceptions.

## Gaps / changes
- None on backend. Frontend: dedicated `POSCheckoutModal` component + idempotency key
  reuse guard so double-tap cannot double-charge.

## TDD
- Unit: change calculation, split-payment sum == total, quick-cash fill, disabled-when-empty.
- Component: modal renders total, enter cash, shows change, single checkout dispatch on confirm.
- Backend: existing checkout idempotency integration test remains green.

## E2E (dev)
Open table -> add product -> `Total` -> enter exact cash -> Cobrar y cerrar ->
assert "Venta completada", visit closed, table free, checkout called exactly once.

## Milestone
Part of **M2**. Done when dev happy-path checkout closes a real visit once.
