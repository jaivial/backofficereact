# POS Implementation Status

## Implemented

- Tenant POS settings with `OFF`, `SHADOW`, `LIVE` stock modes.
- Manual, shadow and live automatic-cover modes.
- Tenant timezone, business-day cutoff and configurable service periods.
- POS entitlement through `pos_pack` recurring feature.
- POS section RBAC, granular operational gates and tenant role-permission management API.
- POS product/category catalogue with full CRUD, tenant VAT assignment and Carta/wine import.
- Product-to-stock mappings with warehouse, base quantity and recipe-output validation.
- Mapping rejection for `PRODUCTION`-only stock items.
- Stock readiness and mapping-exception endpoints/UI.
- Dine-in and takeaway visits, table occupancy and open-ticket recovery.
- Split tickets with full/partial line movement, switching and empty-ticket void UI/API.
- Ticket lines, quantity edits, void reasons and discounts.
- Integer-cent totals with VAT calculation.
- Cash/card/bank/other split payments. Standalone card recording requires terminal reference and exposes daily reconciliation.
- Idempotent visit opening, line creation, checkout, payment and refund commands.
- Atomic checkout with immutable stock snapshots and append-only `SALE` movements.
- Negative stock allowed after POS sale; checkout is not blocked; anomalies are tracked and resolvable.
- Missing mappings close payment with partial stock status and replayable exception.
- Closed dine-in visits feed `stock_affluence_daily` exactly once per visit.
- Manual stock affluence cannot overwrite POS-live keys.
- Cover corrections and deterministic range rebuild.
- Financial refunds; optional authorized line-level physical restock via `RETURN` API.
- Cash shifts and expected-vs-counted close.
- Sales, stock, covers, health and CSV export endpoints.
- Existing restaurant table map overlays open POS visits as occupied.
- `/app/pos` floor, product grid, ticket, checkout, catalogue, mappings, reports and settings UI.
- Internal browser KDS with tenant stations, category/product routes, immutable delta dispatches and controlled acknowledge/ready states.
- One-use audited acceptance records before stock or covers can switch to `LIVE`.
- Backend/React tests, clean MySQL `060`–`068` migrations, concurrent real-MySQL checkout/idempotency integration, Go build, lint, JSX validation and production build.
- Playwright POS flow added and discovered across eight viewport projects; runtime execution pending an authenticated local backoffice stack.

## Migrations

- `064_pos_catalog_and_settings.sql`
- `065_pos_sales.sql`
- `066_pos_stock_and_covers.sql`
- `067_pending_integrations_foundation.sql` — private OCR originals, ops audit, accounting exports, reservation index and actual production labour.
- `068_pos_kitchen_and_activation.sql` — KDS stations/routes/dispatches and audited LIVE activation acceptances.

## Integration foundations delivered

- Reservation selector/prefill and idempotent one-open-visit-per-booking protection.
- Deterministic audited accounting CSV exports for VAT sales, payments, refunds and stock.
- Private OCR original retention/download/delete when private Bunny credentials exist.
- Nightly ops-check command and systemd timer templates.
- Actual production-labour allocation from closed fichaje entries.

Provider/legal adapters remain gated by real contracts in `PENDING_INTEGRATIONS_PLAN.md`.
Owner setup steps and internal development backlog: `INTEGRATIONS_OWNER_AND_DEVELOPMENT_PLAN.md`.
External POS ingestion is cancelled; Villa Carmen POS remains authoritative.

## Production rollout pending

- Add active `pos_pack` recurring feature for pilot tenant.
- Configure service periods, timezone and business-day cutoff.
- Import Carta, review prices/VAT and map highest-volume products.
- Run stock/covers in `SHADOW` for 1–2 weeks.
- Reconcile shadow results against physical counts/manual covers.
- Record readiness evidence, then enable covers `LIVE`, then stock `LIVE` using one-use acceptance gates.
- Grant floor roles only required POS permissions.
- Obtain fiscal/legal approval before calling generated receipt fiscal.

## Deferred external integrations

Full dependency-ordered plan: `PENDING_INTEGRATIONS_PLAN.md`.

- Certified fiscal/VeriFactu/TicketBAI provider.
- Integrated physical card terminal/provider webhooks; standalone terminal reference/reconciliation is implemented.
- Hardware-specific printer agent after device/protocol inventory; browser KDS is implemented.
- Offline multi-terminal conflict journal.
- Delivery marketplaces, loyalty and gift cards.
