# Plan: Salones CRUD + config fixes (backoffice + backend)

Branches: `feat/salones-config` in both repos, PRs against `main`.

## Assumptions (defaults, user said "proceed with defaults")
1. **Mesas limit**: lift 40 cap → numeric range 0-99, then "Sin limite" (999). Helper text updated.
2. **Salones schema**: `salones` table FK->restaurants + FK->floors, `ON DELETE CASCADE` on floor delete. Floor disable -> app-layer sets related salones active=0.
3. **Override model**: single generic table `salon_status_overrides(restaurant_id, date, scope ENUM('floor','salon'), target_id, active)` - absence falls back to global default from `/app/config`.
4. **Review loop**: self-review checklist (lint+typecheck+build+tests) substituting pr-review tool; max 5 iterations per PR.

## Work items
### A. Bug fixes (backoffice, TDD)
- A1 `configHelpers.normalizeTableLimit` / `tableLimitValues`: 0-99 + 999. Unit tests.
- A2 Optimistic UI for floors count + toggle: `ConfigRestaurante` gets `onFloorsChanged`/`onDefaultsChanged` callbacks patching parent state; rollback+error on failure.
- A3 Same optimistic pattern for mesas/daily/defaults saves.

### B. Backend (TDD: Go tests)
- B1 Migration `100_create_salones.sql`.
- B2 Migration `101_create_salon_status_overrides.sql`.
- B3 CRUD `/api/bo/config/salones` GET/POST, `/salones/{id}` PUT/DELETE. Floor disable cascades active=0 to salones.
- B4 Global defaults vs per-day override semantics.

### C. Backoffice salones tab UI
- Accordion per planta, nested salones, Anadir salon modal (planta select, name, capacity toggle default 45), optimistic CRUD, lucide Pencil/Trash2 borderless icons, delete confirm modal.

## Verification
- backoffice: `pnpm lint:all && pnpm test && pnpm build`
- backend: `go test ./... && go build ./...`
- PRs via gh, self-review loop (<=5), merge, redeploy docker, re-test.
