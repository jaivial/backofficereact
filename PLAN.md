# Plan: Salones CRUD + Config page fixes (backoffice + backend)

## Assumptions (user did not answer clarifying questions — marked clearly, easy to revisit)

1. **Mesas de 2/3 limit**: numeric range extended from 0-40 to **0-99** plus "Sin limite" (999).
   Backend stores the limit as a string, so no backend change needed.
2. **Salones schema**: `salones` table with FK -> `restaurants.id` and FK -> floors, **ON DELETE CASCADE**
   (deleting floor deletes its salones). Floor disable -> app-layer sync sets salones inactive.
3. **Override model**: mirror the existing per-day override pattern (`mesas_de_dos` etc.):
   - `salon_global_status (restaurant_id, scope, target_id, active)` — global default state edited in /app/config
   - `salon_day_overrides (restaurant_id, reservation_date, scope, target_id, active)` — per-day override in /app/reservas/config?date=
4. **PR review loop**: self-review (lint + typecheck + tests + build) max **5 iterations**,
   since no external `pr-review` agent is available in this environment.

## Workflow

1. Branch `feat/salones-config` in both repos off `main`.
2. **TDD backend**: failing Go tests -> migration -> handlers -> green.
3. **TDD frontoffice**: failing vitest tests -> fix normalizeTableLimit, optimistic UI, salones UI (accordion + modal) -> green.
4. Commit + push, `gh pr create` against `main` in both repos.
5. Self-review loop (lint:all, build, tests) until clean; merge with `gh pr merge`.
6. Checkout main, fetch+pull, delete branches, redeploy docker (`docker compose up -d --build`), run tests against deployed code.

## Bugs (fix with tests)

- **B1** `configHelpers.ts normalizeTableLimit` clamps at 40 -> extend to 99.
- **B2** `ConfigRestaurante` `saveFloorsCount`/`toggleFloorDefault` never update local state -> optimistic UI with rollback on error.
