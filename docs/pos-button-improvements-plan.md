# POS Button Feature Improvement Plan

## Scope

Improve these controls rendered by `pages/app/pos/functionalComponents/POSSellScreen/POSControlRail.tsx` and orchestrated by `POSSellScreen.tsx`:

- Aparcar
- Salón
- Juntar mesas
- Cliente
- Cajón
- Recargo
- Invita
- Empleado
- Tags
- Barra
- Comentario
- Propina

This is an improvement plan, not a greenfield implementation. All 12 controls already have a first-pass handler in `POSSellScreen.tsx` and `usePOSRegister.ts`.

## Current-State Audit

| Button | Existing behavior | Main gap |
|---|---|---|
| Aparcar | Posts note, clears register, lists parked visits in Mesas modal | Restore fetches visit but never explicitly unparks it; note is not shown; recovery has little test coverage |
| Salón | Uses `bootstrap.areas[]` and filters tables by `areaId` | Filter persists between modal sessions; empty/single-area states and area contract are not tested at hook/e2e level |
| Juntar mesas | Lists other open visits and posts selected source ID | Generic single-choice prompt hides covers/totals; empty list can still confirm; no UI proof that source table becomes free |
| Cliente | Saves name and NIF/CIF on visit | No NIF validation, clear/remove flow, visible ticket summary, or restore-persistence test |
| Cajón | Offers sin venta/cambio/arqueo and sends an idempotency key | No current-shift state in register, no client-side shift gate, no busy/in-flight guard, and double-clicks generate separate keys |
| Recargo | Supports amount/percent and requires reason | No preview or range checks; coexistence with discount and server-authoritative recalculation are untested |
| Invita | Comps selected line through `/comp` | Action is enabled without a selected line; comp status is not displayed; ACTIVE/kitchen/stock invariants are not covered end to end |
| Empleado | Stores `operatorMemberId` on ticket | User must type raw member ID; no operator catalogue, visible assignment, clear/reassign flow, or stale-member handling |
| Tags | Loads catalogue and attaches one tag | No detach or multi-select; assignments live only in local state and disappear after reload; tags are not shown on line |
| Barra | Creates visit with `channel: "BAR"` | Can replace an active register; rapid clicks are not guarded; BAR persistence is only request-body tested |
| Comentario | Patches note on selected line | Action is enabled without selection; saved note is not rendered; blank/clear and restored-note behavior are untested |
| Propina | Stores local tip and sends it separately in checkout payments | Tender validation, pending amount, quick cash, and change still use sale total without tip; mixed tender allocation is ambiguous |

## Design Direction

- Keep `usePOSRegister` as command/state boundary. Components should not call POS endpoints directly.
- Extend `/api/admin/pos/bootstrap` once with register-ready reference data and state rather than adding request waterfalls. Proposed additions: `areas`, `operators`, `currentShift`, line `tagIds`, and complete parked/open visit summaries.
- Keep server responses authoritative for visit, ticket, totals, versions, occupancy, tags, and assignment state.
- Add `expectedVersion` and idempotency keys to mutating contracts where backend supports optimistic concurrency/idempotency.
- Generate one idempotency key per user intent. Reuse it for retries and block concurrent submits until request settles.
- Disable context actions when prerequisites are absent. Do not open a modal that can only no-op.
- Extract feature-specific dialogs from `POSSellScreen.tsx` when implementation begins. Suggested components: `POSTablesDialog`, `POSMergeVisitsDialog`, `POSLineMetadataDialog`, and `POSCheckoutDialog`. Keep generic `POSPromptModal` only for truly simple scalar forms.
- Preserve all required `data-*`, ARIA dialog semantics, focus-visible behavior, and 44px mobile targets.

## TDD Workflow

Apply this cycle to each vertical slice:

1. Write one failing behavior test in `POSSellScreen.test.tsx` or `usePOSRegister.test.ts`.
2. If contract changes, write failing backend handler/domain tests before frontend production code.
3. Run focused test and capture red result.
4. Implement minimum command, state, and UI needed for green.
5. Refactor only after focused tests pass.
6. Add or extend Playwright coverage for cross-request workflows and persistence.
7. Run POS suite, JSX lint, full lint/typecheck, production build, then POS e2e.

Use behavior assertions, not implementation assertions:

- Assert exact endpoint, method, body, idempotency key reuse, and returned state.
- Assert disabled/enabled controls, visible summaries, restored state, and accessible roles.
- Assert money in integer cents. Include decimal comma, zero, negative, excess percentage, double-click, stale version, and API failure cases.
- For destructive or financial operations, assert retries do not duplicate effects.

## Shared Foundation

- [ ] Define typed POS contracts outside the hook, for example `pages/app/pos/types/register.ts`; remove duplicate `Settings`, `Ticket`, and `Visit` shapes from `pos.tsx` and `usePOSRegister.ts`.
- [ ] Add `Operator`, `ShiftSummary`, `VisitSummary`, and line `tagIds` contract types.
- [ ] Confirm backend response semantics for parked restore, merge, comp, drawer idempotency, and payment `amountCents` versus `tipCents` before UI changes.
- [ ] Extend bootstrap contract tests for `areas`, parked/open visit summaries, operators, current shift, and persisted line metadata.
- [ ] Add reusable command guard for busy/in-flight state and stable idempotency key per submit intent.
- [ ] Add modal-level support for `canConfirm`, loading, empty state, inline API error, and initial focus; generic field validation alone is insufficient.
- [ ] Show current visit/ticket metadata in `POSTicketPanel`: channel/table, customer, operator, discount, surcharge, and tip where applicable.
- [ ] Render line metadata in `POSTicketPanel`: comp badge, note, and tags.

## Button Plans

### 1. Aparcar

Target: park with optional note, clear register only after success, then recover and unpark from a dedicated Aparcadas list.

**Red tests**

- [ ] Hook: failed park keeps active visit and ticket intact.
- [ ] Hook: successful park clears register only after POST succeeds and reloads visit summaries.
- [ ] Hook: restore parked visit performs explicit unpark command, then loads authoritative visit/tickets.
- [ ] Component: Aparcadas list shows note, table/channel, covers, age/time, and total.
- [ ] Component: recovery removes visit from parked list, restores lines, and prevents duplicate recovery clicks.
- [ ] E2E: park, verify empty register, reopen Aparcadas, recover same ticket and lines.

**Implementation**

- [ ] Replace `restoreVisit(entry)` for parked entries with `restoreParkedVisit(entry.id)`.
- [ ] Use explicit contract such as `POST /visits/{id}/park { parked:false, ... }`, then `GET /visits/{id}`, or make unpark response return complete visit atomically.
- [ ] Give parked visits a dedicated visible section/tab in tables dialog instead of hiding list below table grid.
- [ ] Reset selected line, keypad, checkout, and transient prompts when register is cleared/restored.
- [ ] Keep park note optional but trim it and preserve returned `parkedNote`.

**Acceptance**

- [ ] No command is lost on API failure.
- [ ] Recovered visit is no longer marked parked and can be parked again.
- [ ] Ticket IDs, lines, covers, customer, operator, tags, notes, and totals survive round trip.

### 2. Salón

Target: area chips filter bootstrap tables predictably and accessibly.

**Red tests**

- [ ] Hook: bootstrap stores `areas[]` and preserves `areaId`/`areaName` on tables.
- [ ] Component: Todos is default every time Salón opens.
- [ ] Component: selecting area filters occupied and free tables without changing source data.
- [ ] Component: selected chip exposes `aria-pressed=true`; keyboard activation works.
- [ ] Component: unknown table `areaId`, no areas, one area, and empty selected area have clear fallbacks.
- [ ] E2E: mocked bootstrap with two areas filters grid and restores Todos after close/reopen.

**Implementation**

- [ ] Reset `areaFilter` when opening/closing Salón unless product decision requires sticky filter.
- [ ] Render chips whenever areas exist; avoid special behavior that changes between one and two areas.
- [ ] Show empty-state copy when selected area has no tables.
- [ ] Use stable area IDs, never area names, for filtering and test IDs.

**Acceptance**

- [ ] Every bootstrap table appears under Todos.
- [ ] Area counts and occupancy remain correct after move, merge, park, or restore reloads.

### 3. Juntar Mesas

Target: safely consolidate one or more source visits into current visit, including lines and covers, then release source tables.

**Red tests**

- [ ] Hook: request contains unique source visit IDs, stable idempotency key, and current expected visit/ticket version if contract supports it.
- [ ] Hook: response replaces current visit/tickets from authoritative merged payload and refreshes table occupancy.
- [ ] Component: modal lists only eligible OPEN visits, excluding current, parked, paid, cancelled, BAR, and TAKEAWAY visits unless backend explicitly allows them.
- [ ] Component: rows show source table, covers, line count, and total; confirm is disabled with no selection.
- [ ] Component: multi-select summary previews combined covers and totals.
- [ ] Failure: stale/paid source leaves both visits unchanged and displays server error.
- [ ] E2E: merge two open tables; destination has both line sets and summed covers; source table becomes free.

**Implementation**

- [ ] Replace single-option `POSPromptModal` with `POSMergeVisitsDialog` using checkbox rows.
- [ ] Let backend validate eligibility and perform merge transaction atomically.
- [ ] Return merged visit, all destination tickets/lines, and changed table summaries in one response.
- [ ] Preserve line metadata, kitchen dispatch state, comps, notes, tags, VAT, discounts, and surcharges during merge.
- [ ] Show explicit confirmation because operation changes table ownership.

**Acceptance**

- [ ] Merge is all-or-nothing and idempotent.
- [ ] Source tables become selectable immediately after success.
- [ ] Covers and financial totals equal backend result, not frontend arithmetic.

### 4. Cliente

Target: persist valid customer name and optional NIF/CIF on visit and make assignment visible/editable.

**Red tests**

- [ ] Component: name is required; whitespace-only name cannot submit.
- [ ] Unit: normalize NIF/CIF input to uppercase and validate supported Spanish NIF/NIE/CIF formats, while allowing blank tax ID.
- [ ] Hook: sends normalized values and replaces visit with server response.
- [ ] Component: existing customer values prefill; clear action removes both fields after confirmation.
- [ ] Component: ticket header shows customer name and tax ID without exposing them in unrelated tickets.
- [ ] Persistence: restored/parked visit retains customer data.
- [ ] E2E: assign, close/reopen visit, edit customer, verify updated values.

**Implementation**

- [ ] Move normalization/validation to tested `utils/customerTaxId.ts`; backend remains final validator.
- [ ] Change customer endpoint to return updated visit instead of relying on optimistic local merge.
- [ ] Add explicit remove action; do not overload blank required name submission.
- [ ] Surface backend duplicate/invalid tax ID messages inline.

**Acceptance**

- [ ] Customer survives bootstrap, park/restore, table move, merge, and checkout receipt flow.
- [ ] Invalid NIF/CIF never sends request from UI and is rejected by backend if bypassed.

### 5. Cajón

Target: open drawer for sin venta, cambio, or arqueo only with eligible open shift, exactly once per user intent.

**Red tests**

- [ ] Hook: bootstrap/current-shift response gates drawer availability when `requireOpenShift` is true.
- [ ] Component: closed shift disables Cajón and explains how to open a shift.
- [ ] Component: each reason chip sends exact enum and trimmed optional note.
- [ ] Concurrency: double-click produces one request.
- [ ] Retry: failed retry reuses same idempotency key until success/cancel; a new modal intent gets a new key.
- [ ] Backend: same key records/opens once; different key records a second event; closed shift returns domain error.
- [ ] E2E: closed shift blocked, open shift succeeds, duplicate submit counted once.

**Implementation**

- [ ] Include `currentShift` in register bootstrap or fetch it once through register state.
- [ ] Set busy before request and disable close/confirm consistently during submission.
- [ ] Generate idempotency key when drawer modal opens, not inside each POST call.
- [ ] Treat physical drawer command and audit event as one backend transaction/result.

**Acceptance**

- [ ] Drawer cannot open outside required shift.
- [ ] Audit record contains operator, terminal, reason, note, shift, timestamp, and idempotency key.

### 6. Recargo

Target: apply amount or percentage surcharge with mandatory reason while preserving independent discount state.

**Red tests**

- [ ] Component: zero, negative, non-number, and invalid percentage cannot submit.
- [ ] Component: decimal comma amount converts once to integer cents.
- [ ] Component: preview shows base, discount, surcharge, VAT, and final total from agreed calculation rules.
- [ ] Hook: amount body uses `amountCents`; percentage body uses `percent`; reason is trimmed.
- [ ] Integration: discount then surcharge and surcharge then discount produce same policy-defined result and preserve both fields.
- [ ] Backend: repeated idempotency key does not duplicate surcharge; stale ticket version is rejected.
- [ ] E2E: apply discount and surcharge, verify both visible and checkout total equals server total.

**Implementation**

- [ ] Confirm calculation order and taxable-base/VAT rules in backend contract; document them in tests.
- [ ] Return adjustment list plus recalculated ticket from endpoint.
- [ ] Add `expectedVersion` and stable idempotency key.
- [ ] Add remove/replace surcharge flow instead of stacking accidental duplicates, unless product explicitly supports multiple surcharges.

**Acceptance**

- [ ] Discount and surcharge coexist as distinct auditable adjustments.
- [ ] UI never calculates persisted VAT or final total independently of backend.

### 7. Invita

Target: comp selected line financially while line remains ACTIVE for kitchen dispatch and stock deduction.

**Red tests**

- [ ] Component: Invita is disabled until one active line is selected.
- [ ] Component: modal identifies product/quantity and requires reason.
- [ ] Hook: returned line remains `status: "ACTIVE"`, becomes `comped:true`, and total updates.
- [ ] Hook/component: uninvite flow restores price without recreating line.
- [ ] Kitchen integration: comped ACTIVE line remains in pending kitchen lines and dispatch payload.
- [ ] Backend stock integration: checkout of comped line still creates configured stock deduction.
- [ ] E2E: comp line, send kitchen, checkout zero/remaining total, verify ACTIVE/comp badge and one dispatch.

**Implementation**

- [ ] Add selected-line prerequisite to `disabledRailKeys`.
- [ ] Render Comp badge, reason, original line value, and charged value.
- [ ] Keep comp as pricing metadata; never implement it through void/status mutation.
- [ ] Define zero-total checkout policy for fully comped tickets so visit can close without fake tender.
- [ ] Add stable idempotency/version protection if endpoint currently lacks it.

**Acceptance**

- [ ] Comp affects customer charge only.
- [ ] Kitchen quantities, stock movements, sales audit, and VAT/accounting treatment follow documented backend policy.

### 8. Empleado

Target: select operator by name from eligible member catalogue and persist assignment on ticket.

**Red tests**

- [ ] Bootstrap contract: returns eligible active operators with ID and display name.
- [ ] Component: searchable/selectable list displays names, never requires raw ID entry.
- [ ] Component: current operator is preselected and shown in ticket header.
- [ ] Hook: assign, reassign, and clear use exact operator ID and replace ticket from server response.
- [ ] Failure: inactive/unauthorized operator is rejected and current assignment remains.
- [ ] Persistence: switch split tickets and restore visit show each ticket's persisted operator.
- [ ] E2E: assign operator, reload visit, verify assignment.

**Implementation**

- [ ] Prefer POS-scoped `operators[]` in bootstrap over coupling sell screen to full member administration API.
- [ ] Replace numeric field with accessible listbox/select dialog.
- [ ] Return updated ticket from operator endpoint.
- [ ] Decide whether operator defaults from logged-in member and whether assignment is ticket-level or visit-level; encode decision in contract tests.

**Acceptance**

- [ ] Only eligible active operators can be assigned.
- [ ] Assignment appears in audit/receipt data and survives reload.

### 9. Tags

Target: load active tag catalogue and attach/detach multiple tags on selected line with persisted display.

**Red tests**

- [ ] Component: Tags is disabled without selected active line.
- [ ] Hook: catalogue loading shows loading, empty, success, and error states.
- [ ] Component: existing line tags are checked when modal opens.
- [ ] Hook: save computes attach/detach delta or sends complete tag ID set according to contract.
- [ ] Component: cancel does not mutate line tags; successful save renders tag chips.
- [ ] Persistence: fetched/restored ticket line carries tag IDs and renders names after reload.
- [ ] Concurrency: stale line version does not overwrite another terminal's tag changes.
- [ ] E2E: add two tags, remove one, restore visit, verify remaining tag.

**Implementation**

- [ ] Add `tagIds` to `TicketLine`; remove separate ephemeral `lineTags` source of truth.
- [ ] Replace one-option prompt with multi-select `POSLineMetadataDialog`.
- [ ] Prefer one atomic endpoint such as `PUT /tickets/{ticketId}/lines/{lineId}/tags { tagIds, expectedVersion }`.
- [ ] Filter inactive tags from new assignment but still display legacy/inactive tags already attached.

**Acceptance**

- [ ] Tags survive reload, park/restore, split, and merge.
- [ ] Save is atomic and does not silently lose concurrent changes.

### 10. Barra

Target: open a tableless BAR visit, never TAKEAWAY, without replacing unsaved active work.

**Red tests**

- [ ] Hook: request uses `channel:"BAR"`, `covers:0`, no `tableId`, and one stable idempotency key.
- [ ] Component: Barra is available with empty register and disabled or confirmation-gated with active visit.
- [ ] Concurrency: rapid double-click creates one BAR visit.
- [ ] Hook: server response with BAR channel becomes active register and survives bootstrap/restore.
- [ ] Regression: `openTakeaway` still sends TAKEAWAY and is not called by Barra.
- [ ] E2E: open Barra, add item, reload/restore, verify channel BAR and no occupied table.

**Implementation**

- [ ] Do not allow `openBar` to overwrite active `visit`/`ticket`; simplest policy is disable until register is clear.
- [ ] Add in-flight guard and stable intent key.
- [ ] Display Barra in ticket metadata so channel is obvious.
- [ ] Ensure table occupancy remains unchanged after BAR open/close.

**Acceptance**

- [ ] Every Barra request persists BAR channel.
- [ ] Active dine-in ticket can never disappear because Barra was pressed.

### 11. Comentario

Target: add, edit, and clear free-text note on selected active line and show it in ticket/kitchen context.

**Red tests**

- [ ] Component: Comentario is disabled without selected active line.
- [ ] Component: existing note prefills; save trims outer whitespace; clear submits empty note intentionally.
- [ ] Hook: PATCH preserves quantity and sends expected ticket version.
- [ ] Component: saved note appears under line immediately from server response.
- [ ] Persistence: note survives restore, split, merge, and kitchen dispatch payload/view.
- [ ] Failure: stale version keeps editor open with entered text and displays conflict.
- [ ] E2E: add note, send kitchen, verify note remains visible after reload.

**Implementation**

- [ ] Add selected-line prerequisite to `disabledRailKeys`.
- [ ] Render multiline note with safe wrapping in `POSTicketPanel`.
- [ ] Use textarea-capable modal field; extend prompt field type or dedicated line metadata dialog.
- [ ] Keep explicit clear action so empty note is distinguishable from accidental blank submit.

**Acceptance**

- [ ] Notes remain metadata on ACTIVE line and are visible where kitchen staff need them.
- [ ] Quantity, price, comp, and tags are unchanged by note edit.

### 12. Propina

Target: add tip to amount due/tendered while excluding it from sale total, taxable base, and VAT.

**Red tests**

- [ ] Unit: `amountDueCents = ticketTotal + tipCents`; sale total and tax fields remain unchanged.
- [ ] Component: pending, quick exact cash, confirmation gate, and change use amount due including tip.
- [ ] Component: zero clears tip; negative/non-number cannot submit; decimal comma rounds once to cents.
- [ ] Hook: cash-only, card-only, and mixed tenders allocate sale and tip exactly according to backend payment contract.
- [ ] Hook: tender below sale plus tip is rejected; over-tender returns correct cash change.
- [ ] Hook: card reference remains required when card contributes to sale or tip.
- [ ] Backend: ticket sale/VAT reports exclude tip; payment/tender record and gratuity report include it exactly once.
- [ ] Idempotency: duplicate checkout does not duplicate sale or tip.
- [ ] E2E: €2.50 sale + €1 tip requires €3.50 tender, posts €1 tip, reports €2.50 sale, and zero change at €3.50.

**Implementation**

- [ ] Move tip state into checkout/register state so closing and reopening modal has explicit keep/reset behavior.
- [ ] Introduce tested pure payment allocation utility using integer cents.
- [ ] Separate `saleTotalCents`, `tipCents`, `amountDueCents`, `tenderedCents`, and `changeDueCents` names.
- [ ] Confirm API semantics: whether payment `amountCents` excludes tip with separate `tipCents`, or includes total tender. Encode one model in contract tests and remove ambiguity.
- [ ] Show sale, tip, total due, tendered, pending, and change as separate checkout rows.

**Acceptance**

- [ ] Tip never changes ticket `totalGrossCents`, net sales, taxable base, or VAT.
- [ ] Collected payment equals sale plus tip, less cash change, for cash/card/mixed tender.

## Suggested Delivery Order

1. [ ] Shared typed contracts, bootstrap enrichment, command guards, and modal validation.
2. [ ] Propina: highest financial mismatch risk.
3. [ ] Recargo: financial/VAT and discount coexistence.
4. [ ] Invita: kitchen, stock, and zero-total close invariants.
5. [ ] Juntar mesas: transactional multi-visit integrity.
6. [ ] Aparcar: lifecycle and full-state recovery.
7. [ ] Cajón: shift and audit/idempotency controls.
8. [ ] Barra: channel and active-register safety.
9. [ ] Cliente and Empleado: persisted ticket ownership/identity.
10. [ ] Tags and Comentario: persisted line metadata.
11. [ ] Salón: filter state, accessibility, and edge cases.

Each numbered delivery item should be independently releasable with tests green.

## Expected File Changes

| File/path | Planned change |
|---|---|
| `pages/app/pos/types/register.ts` | New canonical POS frontend contracts |
| `pages/app/pos/hooks/usePOSRegister.ts` | Harden commands, persistence, idempotency, shift/operators, payment model |
| `pages/app/pos/hooks/usePOSRegister.test.ts` | Command, contract, failure, concurrency, and persistence tests |
| `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx` | Reduce orchestration and enforce prerequisites |
| `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx` | User-visible behavior tests for all 12 buttons |
| `pages/app/pos/functionalComponents/POSSellScreen/POSTicketPanel.tsx` | Render visit, operator, customer, comp, note, tags, and adjustments |
| `pages/app/pos/functionalComponents/POSSellScreen/POSPromptModal.tsx` | Loading/error/validation/textarea support only if still generic |
| `pages/app/pos/functionalComponents/POSSellScreen/POS*Dialog.tsx` | Focused table, merge, line metadata, and checkout dialogs as needed |
| `pages/app/pos/utils/paymentAllocation.ts` | Pure integer-cent tender/tip allocation |
| `pages/app/pos/utils/paymentAllocation.test.ts` | Cash/card/mixed/rounding test matrix |
| `pages/app/pos/utils/customerTaxId.ts` | NIF/NIE/CIF normalization and client validation |
| `pages/app/pos/utils/customerTaxId.test.ts` | Valid, invalid, blank, lowercase, and whitespace cases |
| `e2e/specs/pos/pos.spec.ts` | Route-mocked workflows for deterministic edge cases |
| `e2e/specs/pos/pos.smoke.dev.spec.ts` | Minimal real-backend lifecycle smoke |
| Backend POS handlers/domain tests | Atomic merge, park restore, shift gate, adjustments, comp/stock, metadata, and tip accounting contracts |

Do not create every suggested component or utility up front. Extract only when its feature slice needs it.

## Verification Commands

Run focused red/green tests during each slice:

```bash
bun test pages/app/pos/hooks/usePOSRegister.test.ts
bun test pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx
bun test pages/app/pos/utils
```

Run completion gates:

```bash
bun test
pnpm lint:jsx
pnpm lint:all
pnpm build
bun test:e2e -- e2e/specs/pos/pos.spec.ts
```

Run backend POS tests through the backend repository's focused package command after contract locations are confirmed. Do not consider financial or transaction features complete using mocked frontend responses alone.

## Definition of Done

- [ ] All 12 buttons have positive, validation, API-failure, and prerequisite tests.
- [ ] Financial actions use integer cents and backend-authoritative totals.
- [ ] Mutating actions block concurrent submits and are idempotent where duplicates matter.
- [ ] Park/restore, merge, reload, split, and checkout preserve relevant metadata.
- [ ] Line actions require an active selected line.
- [ ] Current customer, operator, tags, comments, comp, surcharge, and tip state is visible.
- [ ] Dialogs have accessible names, keyboard operation, initial/focus return behavior, and mobile targets.
- [ ] Every JSX/HTML tag added has a differentiating `data-*` attribute before `/>`.
- [ ] Focused unit tests, full tests, JSX lint, typecheck/lint, production build, mocked POS e2e, and real-backend smoke pass.
