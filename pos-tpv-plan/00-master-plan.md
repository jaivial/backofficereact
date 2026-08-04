# POS / TPV Restaurant Terminal — Master Development Plan

> **Scope:** Polish and complete the restaurant Point-of-Sale (TPV) already started
> in `pages/app/pos`. Build an intuitive, visual, touch-first selling screen backed
> by our real product catalogue and the existing `/api/admin/pos/*` backend,
> validated end-to-end against `https://backoffice-dev.menustudioai.com`.
>
> **Method:** Test-Driven Development (unit + component + backend integration) plus
> real-app E2E Playwright coverage. Every phase is red -> green -> refactor, and no
> phase is "done" until its Playwright milestone passes against the dev environment.

---

## 0. Ground truth (confirmed by repository inspection)

### Frontend
- Page entry: `pages/app/pos/+Page.tsx` -> `pages/app/pos/pos.tsx` (one large
  component today; sections: `sell | kitchen | catalog | stock | reports | settings`).
- Existing functional components under `pages/app/pos/functionalComponents/`:
  `POSAdminPanel`, `POSActivationPanel`, `KitchenDisplay`, `KitchenSettings`,
  `CardReconciliation` (each already has a co-located `.test.tsx`).
- Reference styling & patterns to mirror: `pages/app/comida/@foodType`
  (`+Page.tsx`, `functionalComponents/FoodList`, `_components/FoodItemCard`,
  `_components/FoodFilters`). Uses `bo-*` design-system classes, `data-role` /
  `data-ui` / `data-slot` / `data-testid` attributes, and shared `ui/` primitives.
- Reusable primitives in `ui/`: `ui/shell` (Card, Panel, Sidebar, Topbar,
  PageToolbar), `ui/inputs` (Select...), `ui/actions` (FloatingActionButton...),
  `ui/overlays` (ConfirmDialog...), `ui/feedback` (LoadingSpinner, useErrorToast),
  `ui/mobile`, `ui/shadcn` (Switch...), `ui/theme` (dark/light). Reuse these; do not
  fork new primitives.
- Layout shell: `pages/app/+Layout.tsx` renders `<Sidebar>` + `<main class="bo-main">`
  with `<Topbar>`. Full-screen precedent already exists: `isReservasTables` toggles
  `bo-main--immersive` and omits `<Topbar>`. Mobile bottom nav is `Sidebar`
  `bo-navMobile` (`data-testid="sidebar-nav-mobile"`); desktop nav `bo-navDesktop`.
  Topbar is `data-testid="topbar"`.

### Backend (`/var/www/newvillacarmen/backend`)
- POS API fully routed in `internal/api/server.go` under `/api/admin/pos/*`
  (handlers in `internal/api/backoffice_pos*.go`). Documented in
  `backend/ENDPOINTS.md` (`## POS / TPV`).
- Multi-tenant (`restaurant_id`), permission-gated (`pos.view`, `pos.sell`,
  `pos.checkout`, `pos.discount`, `pos.line.void`, `pos.visit.manage`,
  `pos.kitchen.manage`, `pos.shift.manage`, `pos.refund`, `pos.settings.manage`...)
  and subscription-gated (`pos_pack`).
- Migrations `064`-`068` created POS catalogue, sales, stock/covers, kitchen and
  activation tables (`POS_IMPLEMENTATION_PLAN.md` section 5).

### Products / categories source of truth
- The selling grid MUST render POS products grouped by POS categories from
  `GET /api/admin/pos/bootstrap` (`products[]`) and `GET /api/admin/pos/categories`.
- POS products are seeded/imported from our real Carta (platos, bebidas, cafes,
  vinos, arroces, entrantes, postres...) via
  `POST /api/admin/pos/products/import-preview` + `import-confirm`. The grid never
  invents products; it reads the tenant catalogue.

### E2E credentials & environment
- Base URL for real E2E: `https://backoffice-dev.menustudioai.com`.
- Credentials from `/var/www/newvillacarmen/backend/.env`
  (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`). Playwright reads them via
  `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (`e2e/global-setup.ts`). Session cached
  in `test-results/.session-cache.json`.

---

## 1. Product goals (from the brief)

1. Intuitive, visual, touch-first UX: big 1:1 photo tiles (0.5rem radius, name
   below), one-tap selection, minimal chrome, thumb-reachable action rail. Backed
   by researched real-POS conventions (`01-ui-ux-research.md`).
2. Integrated vs. Full-screen tab switcher: *Integrado* (inside the normal shell)
   and *Pantalla completa* (hides `Sidebar`, `data-testid="topbar"`, and the mobile
   bottom nav so POS uses the whole viewport).
3. Real catalogue: categories/groups + products from the tenant POS catalogue.
4. Control action rail with 22 features (each has its own plan under `features/`).
5. Design consistency: reuse the same reusable components and dark/light theme as
   `app/comida/platos`.

---

## 2. Target layout (the "sell" screen)

```
+-------------------------------------------------------------+-----------+
| TOP ROW (column top block)                                  |           |
| +---------------------------+-----------------------------+ |  CONTROL  |
| | Ticket / comanda register | Numeric keypad (calculator) | |   RAIL    |
| | of the active table       | qty . price edit . table no | | (right    |
| | (lines, qty, totals)      | discount/surcharge/tip entry| |  side)    |
| +---------------------------+-----------------------------+ |           |
+-------------------------------------------------------------+  Total    |
| BOTTOM ROW (product selection)                              |  Aparcar  |
| +---------------+-------------------------------------------+ |  Mesa   |
| | Categories /  | Products of the selected category        | |  Salon  |
| | groups panel  | 1:1 photo . 0.5rem radius . name below   | |  ...    |
| | (photo+name)  | one-tap add                              | |  Pack   |
| +---------------+-------------------------------------------+ |         |
+-------------------------------------------------------------+-----------+
```

- Outer container = row: [left column of two stacked two-pane rows] + [right control rail].
- Left column = top block (ticket | keypad) stacked over bottom block (categories | products).
- Category tiles and product tiles: square 1:1 image, `border-radius: 0.5rem`, title below.
- Keypad is context-aware: default = calculator; line selected = quantity; price
  mode = unit-price edit; also feeds Mesa (table number), discount, surcharge, tip, covers.

### Component decomposition (new, under `pages/app/pos/functionalComponents/`)
- `POSSellScreen/` orchestrator for the sell view.
- `POSViewSwitcher/` Integrado / Pantalla completa switcher.
- `POSCategoryPanel/` category/group tiles (image + name).
- `POSProductGrid/` product tiles (reuse `FoodItemCard`-style visuals).
- `POSTicketPanel/` comanda register + line selection.
- `POSKeypad/` numeric keypad with contextual modes.
- `POSControlRail/` the 22-button rail (buttons dispatch to feature modules).
- Per-feature modals: `POSTablePickerModal/`, `POSFloorModal/`, `POSCheckoutModal/`, etc.
- Shared state: extract `pages/app/pos/hooks/usePOSRegister.ts` (visit, ticket,
  splitTickets, keypad mode) to shrink the monolithic `pos.tsx`.

Full-screen mode: add `bo-main--immersive`-style behaviour driven from the POS page
(a page-level context/atom `+Layout.tsx` reads, mirroring `isReservasTables`), so
`Sidebar`, `Topbar` and `bo-navMobile` hide when POS full-screen is active.

---

## 3. Feature -> backend mapping (drives per-feature plans)

Legend: OK = endpoint exists; EXT = extend existing; NEW = new backend work; FE = frontend-only.

| #  | Rail button      | Backend today                                                    | Class |
|----|------------------|------------------------------------------------------------------|-------|
| 1  | Total            | `POST /pos/tickets/{id}/checkout`, `/visits/{id}/close`, payments | OK    |
| 2  | Aparcar ticket   | open visit persists, recover via `/visits/{id}`                   | EXT   |
| 3  | Mesa             | `POST /pos/visits` (tableId), `PATCH /pos/visits/{id}`           | OK/EXT|
| 4  | Salon            | table map + `bootstrap.tables[].occupied`                        | EXT   |
| 5  | Juntar mesas     | none                                                             | NEW   |
| 6  | Borrar comanda   | `POST /pos/tickets/{id}/void`, `/visits/{id}/cancel`             | OK    |
| 7  | Combinado        | line create + modifiers                                          | NEW   |
| 8  | Cliente          | `GET /pos/reservations/eligible`, booking link                   | EXT   |
| 9  | Cocina           | `POST /pos/tickets/{id}/kitchen-dispatches`, `/kitchen/queue`    | OK    |
| 10 | Cajon            | none (hardware)                                                  | NEW/FE|
| 11 | Descuento (Dto.) | `POST /pos/tickets/{id}/discount`                                | OK    |
| 12 | Recargo          | discount is deduction-only                                       | EXT/NEW|
| 13 | Invita           | discount 100% / line void reason                                 | EXT   |
| 14 | Empleado         | session user; `pos.*` perms                                      | EXT   |
| 15 | Separar comanda  | `POST /pos/visits/{id}/tickets`, `/lines/{lineId}/move`         | OK    |
| 16 | Tags/Etiquetas   | none                                                             | NEW   |
| 17 | Barra            | channel enum (DINE_IN/TAKEAWAY)                                  | EXT   |
| 18 | Comentario       | none                                                            | NEW   |
| 19 | Dividir comanda  | line move + split tickets                                        | OK/EXT|
| 20 | Suplemento       | none                                                            | NEW   |
| 21 | Propina          | payments (tip currently a non-goal)                             | EXT/NEW|
| 22 | Pack             | none                                                            | NEW   |

Each row has a dedicated plan in `features/NN-*.md` with UX, DB schema deltas, API
contract, TDD tests, and E2E scenario.

---

## 4. Phases, todolists & milestones

Each phase: write failing tests first, implement, refactor, then prove with a
Playwright run against `backoffice-dev.menustudioai.com`.

### Phase 0 — Foundations & harness (no user-visible change)
- [ ] Add POS full-screen page context/atom; teach `+Layout.tsx` to hide `Sidebar`
      / `Topbar` (`data-testid="topbar"`) / `bo-navMobile` when active (mirror
      `isReservasTables`). Unit test the layout branch.
- [ ] Extract `usePOSRegister` hook + types from `pos.tsx`; keep behaviour
      identical (characterization tests around current flow).
- [ ] Add POS `data-testid` contract (`pos-view-switch`, `pos-fullscreen`,
      `pos-category-<id>`, `pos-product-<id>`, `pos-ticket`, `pos-keypad-<key>`,
      `pos-rail-<feature>`). Document here.
- [ ] Wire Playwright to dev env: helper logs in with `.env` bootstrap admin and
      asserts POS pack entitlement; skip-with-message if `pos_pack` off.
- **Milestone M0:** `pos.spec.ts` green locally (mocked) AND a new
  `pos.smoke.dev.spec.ts` loads `/app/pos` on dev with real session and sees the sell screen.

### Phase 1 — Visual sell screen (UI/UX)
- [ ] `POSViewSwitcher` (Integrado/Pantalla completa) + full-screen wiring.
- [ ] `POSCategoryPanel` + `POSProductGrid` with 1:1 images, 0.5rem radius, name
      below, one-tap add - fed by real `bootstrap.products` + `/pos/categories`.
- [ ] `POSTicketPanel` (line list, select line, qty badges, totals).
- [ ] `POSKeypad` with contextual modes (calc/qty/price).
- [ ] `POSControlRail` shell with all 22 buttons (dispatch stubs + per-permission disabled states).
- [ ] Dark/light theme parity check vs `app/comida/platos`.
- Tests: component test per new component (render, one-tap add updates ticket,
  keypad qty edit, view switch hides chrome).
- **Milestone M1:** E2E on dev - open table, tap category, tap product, qty via
  keypad, see ticket total; toggle full-screen and assert `topbar` hidden.

### Phase 2 — Core selling & closing (OK-classified)
Features: Total(1), Mesa(3), Borrar comanda(6), Cocina(9), Descuento(11),
Separar comanda(15), Dividir comanda(19). Wire each button to its endpoint + modal; per-feature TDD.
- **Milestone M2:** E2E on dev - full happy path: open -> add -> discount -> split
  -> kitchen dispatch -> checkout/pay -> visit closed (assert single checkout call).

### Phase 3 — Table/room & session ops
Features: Salon(4), Aparcar(2), Juntar mesas(5), Empleado(14), Barra(17).
Backend: NEW merge endpoint, EXT parked flag, BAR channel.
- **Milestone M3:** E2E on dev - park a ticket and recover it; merge two tables into
  one comanda; open a bar fast-sale.

### Phase 4 — Line economics & modifiers
Features: Recargo(12), Invita(13), Suplemento(20), Combinado(7), Pack(22), Propina(21).
Backend: NEW modifier/supplement/combo/pack model + surcharge sign + tip capture.
Land the shared modifier schema first.
- **Milestone M4:** E2E on dev - add a combo + supplement, apply surcharge, comp a
  line (Invita), add tip at checkout, sell a pack that expands to lines.

### Phase 5 — Metadata & customer
Features: Cliente(8), Tags/Etiquetas(16), Comentario(18), Cajon(10).
Backend: EXT customer attach, NEW tags + notes, NEW/FE drawer event/audit.
- **Milestone M5:** E2E on dev - attach customer, tag a ticket, add a comment visible
  in kitchen, trigger cajon event (audited).

### Phase 6 — Hardening, a11y, performance, rollout
Keyboard/touch a11y pass, large-catalogue virtualization, error toasts,
empty/permission states, full regression E2E across Playwright viewport projects,
docs update in `POS_IMPLEMENTATION_STATUS.md`.
- **Milestone M6:** Green full E2E suite on dev across desktop + tablet viewports; sign-off complete.

---

## 5. TDD strategy

- Unit/logic: Vitest for money math, keypad state machine, register-hook reducers,
  feature guards. Co-locate `*.test.ts(x)` beside source. Write the failing test first.
- Component: RTL / Playwright CT (`*.ct.test.tsx`, as in `FoodList.ct.test.tsx`) per
  new component: render, a11y roles, `data-testid` contract, interaction -> state.
- Integration (backend): extend `internal/api/backoffice_pos_*_test.go` with
  real-MySQL tests for every NEW/EXT endpoint (merge, surcharge, modifiers, tags,
  notes, park, tip) including idempotency and permission gates.
- E2E (real app): Playwright specs in `e2e/specs/pos/` run against
  `backoffice-dev.menustudioai.com` with the bootstrap admin session. Two tiers:
  (a) mocked-route fast specs (like current `pos.spec.ts`) for deterministic UI
  logic; (b) real-backend `*.dev.spec.ts` for true flows. Each phase adds/updates
  its milestone spec. A phase is not done until its dev E2E passes.

### Red -> green loop per task
1. Write/adjust the failing unit or component test for the smallest behaviour.
2. Implement minimally to pass.
3. Refactor with tests green.
4. Add/extend the phase Playwright milestone; run against dev; fix; repeat.

---

## 6. Debugging & validation workflow

- Local: `bun run test` (Vitest), `bun run lint`, component tests, JSX/TS build.
  Backend: `go test ./internal/api/...` with real MySQL.
- Dev E2E:
  ```bash
  export E2E_ADMIN_EMAIL=$(grep BOOTSTRAP_ADMIN_EMAIL /var/www/newvillacarmen/backend/.env | cut -d= -f2)
  export E2E_ADMIN_PASSWORD=$(grep BOOTSTRAP_ADMIN_PASSWORD /var/www/newvillacarmen/backend/.env | cut -d= -f2)
  BACKOFFICE_URL=https://backoffice-dev.menustudioai.com bunx playwright test e2e/specs/pos
  ```
- Triage: on failure use Playwright trace/video (`test-results/artifacts`), the HTML
  report (`test-results/playwright-report`), and re-run headed (`HEADED=1`).
  Reproduce API issues with authenticated requests against dev before touching UI.
- Definition of Done per feature: unit+component green, backend integration green
  (if applicable), dev E2E milestone green, dark/light verified, permission gating
  verified, `data-testid` documented.

---

## 7. Risks & sequencing

- Entitlement/data on dev: POS needs `pos_pack` active and an imported catalogue for
  the pilot tenant. First dev task: verify/seed via catalogue import; otherwise E2E
  must skip with an explicit message, not silently pass.
- Backend gaps are the critical path for Phases 3-5. Land the shared modifier schema
  (supplement/combo/pack) before individual modifier buttons.
- Fiscal/tip/drawer touch legal/hardware boundaries already flagged as non-goals in
  `POS_IMPLEMENTATION_PLAN.md`: keep tip/drawer as captured metadata + audit now;
  defer certified fiscal + physical drawer agent.
- Keep `pos.tsx` decomposition incremental to avoid regressing the delivered flow;
  characterization tests guard it.

---

## 8. Index of feature plans

See `features/`: `01-total.md`, `02-aparcar-ticket.md`, `03-mesa.md`, `04-salon.md`,
`05-juntar-mesas.md`, `06-borrar-comanda.md`, `07-combinado.md`, `08-cliente.md`,
`09-cocina.md`, `10-cajon.md`, `11-descuento.md`, `12-recargo.md`, `13-invita.md`,
`14-empleado.md`, `15-separar-comanda.md`, `16-tags-etiquetas.md`, `17-barra.md`,
`18-comentario.md`, `19-dividir-comanda.md`, `20-suplemento.md`, `21-propina.md`,
`22-pack.md`. UI/UX research: `01-ui-ux-research.md`.

---

## Progress log

### 2026-07-29 — M0 + Phase 0 + Phase 1 + Phase 2 core DONE
- **Backend fixes (TDD, `backoffice_pos_import_integration_test.go`)**:
  - Collation bug in import-preview UNION (`comida_items` unicode_ci vs `VINOS` general_ci) → explicit `COLLATE utf8mb4_unicode_ci`.
  - Long names (255 ch) overflowed `pos_products.name` varchar(180) → `LEFT(TRIM(...),180)`.
  - Category link UPDATEs (`pc.name=c.categoria` / `pc.name=v.tipo`) silently failed on same mismatch → fixed; all 49 products categorized.
  - Integration test DB: `newvillacarmen_pos_test` (schema cloned via `CREATE TABLE ... LIKE`), run with `POS_TEST_MYSQL_DSN`.
- **Dev environment seeded**: POS enabled (PATCH /pos/settings), 49 Carta products imported in 8 categories, 10 tables, 2 kitchen stations (Cocina/Barra) + category routes.
- **Phase 0**: `posFullscreenAtom` (state/atoms.ts) + `+Layout.tsx` branch (`bo-main--pos-fullscreen`, hides Sidebar+Topbar only under /app/pos). Tests: `pages/app/Layout.test.tsx` (not `+Layout.test.tsx` — Vike treats `+` files as config and the dev server 500s).
- **Phase 1**: `usePOSRegister` hook extracted from pos.tsx with characterization tests (`pages/app/pos/hooks/`).
- **Phase 2**: `POSSellScreen` + `POSViewSwitcher`, `POSCategoryPanel`, `POSProductGrid`, `POSTicketPanel`, `POSKeypad`, `POSControlRail` (22 features; Total/Mesa/Cocina/Descuento/Separar/Barra wired, rest show "próximamente"). CSS: `components/styles/features/pos/sell-screen.css`.
- **E2E**: `pos.spec.ts` rewritten for new UI (checkout + fullscreen, adminPage fixture); `pos.smoke.dev.spec.ts` real-backend smoke. 24/24 green per project; occasional cross-project flake is Vite dev-server transform latency, not app bugs.
- **Manual dev verification**: full sale on dev (Mesa 1 → Arroz a banda + Azpilicueta → Cocina dispatch → Total → cash 36,50 € → PAID ticket TPV-20260729-0001, visit CLOSED, payment row created).

### Next
- Phase 3: Aparcar, Salón, Cliente, Recargo, Invita, Empleado, Propina (EXT endpoints), keypad-driven covers.
- Phase 4: shared modifier schema (`pos_ticket_line_modifiers`) → Combinado/Suplemento/Pack.
- Remaining rail features per features/*.md.
