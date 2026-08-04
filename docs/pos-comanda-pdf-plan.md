# POS Comanda PDF Plan

## Goal

Add a `Comanda` button directly below `Total` in the POS action rail. For MVP, clicking it downloads an A6 PDF containing the current open order summary so staff can print it and take it to the customer's table.

This document is a pre-bill/order summary, not a fiscal receipt or invoice.

## Current Code References

- `pages/app/pos/functionalComponents/POSSellScreen/POSControlRail.tsx:3` - `RailFeatureKey` and ordered `RAIL_FEATURES` list.
- `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx:216` - rail action dispatcher.
- `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx:182` - disabled rail feature calculation.
- `pages/app/pos/types/register.ts:4` - ticket line, ticket, and visit contracts.
- `pages/app/pos/functionalComponents/POSSellScreen/POSTicketPanel.tsx:70` - current visible order summary.
- `ui/lib/reservationsPdf.ts:107` - existing lazy `jspdf` and `jspdf-autotable` import pattern.
- `pages/app/reportes/helpers/reportExportHelpers.ts:25` - existing PDF generation and `doc.save()` usage.

## Product Decisions

- Button position: immediately after `Total`, before `Aparcar`.
- Button label: `Comanda`.
- Output: downloaded PDF only. No browser print dialog, API storage, email, or printer integration in MVP.
- Format: A6 portrait. Small enough for table delivery, standard enough for desktop/mobile PDF viewers.
- Language and currency: Spanish and EUR.
- Document title: `COMANDA`.
- Legal marker: `Documento no fiscal` displayed prominently.
- Source of truth: current `register.visit` and `register.ticket`; no client-side API refetch unless later concurrency requirements demand it.
- Excluded lines: `VOIDED` lines.
- Comped lines: included with `INVITADA` marker and charged amount `0,00 €`.
- Notes and tags: line note included; tag names included when catalogue data is available.
- Download filename: `comanda-{ticketNumber-or-ticketId}.pdf`, sanitized for filesystem safety.
- Empty ticket: button disabled.
- Generation failure: keep register unchanged and show POS error message.

## PDF Content

### Header

- `COMANDA`
- `Documento no fiscal`
- Ticket number or internal ticket ID fallback
- Generation date and time in Spanish locale format

### Visit Details

- Table name for dine-in visits
- `Barra`, `Para llevar`, or channel fallback for tableless visits
- Covers
- Customer name when assigned
- Assigned employee name when available

### Lines

| Column | Content |
|---|---|
| Cant. | Quantity |
| Producto | Product name |
| P. unitario | Gross unit price |
| Total | Charged line total |

Under each applicable line:

- Note, for example `Nota: Sin cebolla`.
- Tags, for example `Etiquetas: Sin gluten, Para llevar`.
- Comp marker, for example `INVITADA - Invitación de la casa`.

### Totals

- Subtotal when supplied by ticket contract
- Discount when greater than zero
- Surcharge when greater than zero
- Total due

Tip is excluded because this PDF is generated before checkout and represents order total, not tendered payment.

## Architecture

Keep PDF formatting outside React.

Proposed files:

```text
pages/app/pos/
├── types/register.ts
├── utils/
│   ├── comandaPdf.ts
│   └── comandaPdf.test.ts
└── functionalComponents/POSSellScreen/
    ├── POSControlRail.tsx
    ├── POSSellScreen.tsx
    └── POSSellScreen.test.tsx
```

### Pure Snapshot Contract

Define a narrow input independent from hook internals:

```ts
export type ComandaPdfInput = {
  generatedAt: Date;
  ticket: Ticket;
  visit: Visit;
  operatorName?: string;
  tagNamesById?: Record<number, string>;
};
```

Main function:

```ts
export async function downloadComandaPdf(input: ComandaPdfInput): Promise<void>;
```

Implementation rules:

- Dynamically import `jspdf` so opening POS does not eagerly load PDF code.
- Build all amounts from integer cents.
- Escape/sanitize filename independently from visible PDF text.
- Use `doc.splitTextToSize()` for long product names and notes.
- Paginate when line content exceeds A6 page height.
- Repeat compact header on additional pages.
- Never mutate ticket, visit, line, or tag objects.

## TDD Sequence

### 1. PDF Utility Tests: Red

Create `pages/app/pos/utils/comandaPdf.test.ts` before production utility.

Mock `jspdf` rather than creating binary PDF output in jsdom.

- [ ] `renders ticket number, table, covers, and generation date`.
- [ ] `renders every active line with quantity, product, unit price, and charged total`.
- [ ] `excludes voided lines`.
- [ ] `renders comped active lines as invited with zero charged amount`.
- [ ] `renders line notes and resolved tag names`.
- [ ] `renders customer and operator only when supplied`.
- [ ] `renders discount and surcharge only when non-zero`.
- [ ] `always renders Documento no fiscal`.
- [ ] `uses sanitized ticket number in downloaded filename`.
- [ ] `creates another page when line content exceeds available height`.
- [ ] `rejects a ticket with no active lines without downloading`.

Expected assertions:

- Verify `jsPDF` constructor called with A6 portrait options.
- Verify exact `text()` values for legal marker and totals.
- Verify `save("comanda-TPV-20260730-0001.pdf")`.
- Verify original input objects remain deeply equal to pre-call snapshots.

### 2. Control Rail Tests: Red

Update `POSSellScreen.test.tsx` and, if useful, add focused `POSControlRail.test.tsx`.

- [ ] `renders Comanda immediately below Total`.
- [ ] `disables Comanda without an active ticket`.
- [ ] `disables Comanda when ticket has no active lines`.
- [ ] `enables Comanda when active ticket has at least one active line`.
- [ ] `clicking Comanda passes current visit, ticket, operator, tags, and date to PDF utility`.
- [ ] `double click while generation is pending downloads once`.
- [ ] `PDF failure leaves ticket untouched and displays an error`.

Mock `downloadComandaPdf()` in component tests. Do not render real jsPDF there.

### 3. Minimal Implementation: Green

- [ ] Add `"comanda"` to `RailFeatureKey`.
- [ ] Insert `{ key: "comanda", label: "Comanda" }` after Total in `RAIL_FEATURES`.
- [ ] Add Comanda to disabled-key derivation when ticket or active lines are missing.
- [ ] Add `commandPdfBusy` state or ref to prevent duplicate downloads.
- [ ] Build memoized `tagNamesById` and assigned operator name from existing register state.
- [ ] Call utility from rail dispatcher.
- [ ] Set a clear POS success message after download.
- [ ] Set POS error message when generation fails.

### 4. Refactor: Green

- [ ] Keep PDF layout constants in utility file, not component.
- [ ] Keep React handler small and use `useCallback` because callback reaches visual tree.
- [ ] Keep derived operator/tag values memoized with `useMemo`.
- [ ] Avoid adding backend endpoint or shared abstraction until another PDF feature needs same receipt renderer.

### 5. Playwright E2E

Extend `e2e/specs/pos/pos.spec.ts`.

- [ ] Open table and add product.
- [ ] Start Playwright download listener before clicking Comanda.
- [ ] Assert suggested filename matches `comanda-*.pdf`.
- [ ] Save download to test artifacts.
- [ ] Assert download stream is non-empty.
- [ ] Assert ticket remains open and unchanged after download.
- [ ] Assert Comanda is disabled before opening a ticket.

Playwright should not parse PDF text in MVP. Unit tests own content/layout assertions; e2e owns browser download behavior.

## Accessibility and UI Rules

- Existing text button already has an accessible name.
- Preserve 44px mobile target through existing `.pos-rail__btn` styling.
- Button must expose native `disabled` state while unavailable or generating.
- Do not open an empty modal or hidden preview.
- Report generation failures through existing POS alert region.
- Every added JSX tag must include a differentiating `data-*` attribute before `/>`.

## Edge Cases

- [ ] Ticket number absent: use `ticket-{id}` in document and filename.
- [ ] Table name absent: derive label from visit channel.
- [ ] Operator ID no longer present in catalogue: omit operator instead of printing raw ID.
- [ ] Tag ID missing from catalogue: omit unresolved tag instead of printing raw ID.
- [ ] Long names/notes: wrap, never clip.
- [ ] Decimal quantities: format without unnecessary trailing zeroes.
- [ ] Very large order: paginate deterministically.
- [ ] Comped line remains visible despite zero charge.
- [ ] Discount plus surcharge: display both and trust backend total.
- [ ] PDF import/generation error: no state mutation and no success message.

## Expected File Changes

| File | Change |
|---|---|
| `pages/app/pos/functionalComponents/POSSellScreen/POSControlRail.tsx` | Add and position Comanda action |
| `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx` | Guard action, build snapshot, trigger download, report result |
| `pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx` | Test availability, snapshot, duplicate guard, and failure |
| `pages/app/pos/utils/comandaPdf.ts` | New lazy-loaded A6 PDF generator |
| `pages/app/pos/utils/comandaPdf.test.ts` | New PDF content/layout/filename unit tests |
| `pages/app/pos/types/register.ts` | Add line discount field only if required by authoritative response |
| `e2e/specs/pos/pos.spec.ts` | Verify real browser download |

No backend or database change is required for MVP.

## Verification Commands

```bash
bun run test -- pages/app/pos/utils/comandaPdf.test.ts
bun run test -- pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx
bun run test -- pages/app/pos
pnpm lint:jsx
pnpm lint:all
pnpm build
BACKOFFICE_URL=https://localhost:3010 pnpm exec playwright test e2e/specs/pos/pos.spec.ts --project=chromium
```

## Definition of Done

- [ ] Comanda appears directly below Total.
- [ ] Button is enabled only for a current ticket with active lines.
- [ ] One click downloads one non-empty A6 PDF.
- [ ] PDF contains active order lines, visit context, optional metadata, adjustments, total, and `Documento no fiscal`.
- [ ] Voided lines are excluded; comped lines remain visible at zero charge.
- [ ] Download never changes ticket, visit, kitchen, stock, or payment state.
- [ ] Unit, component, JSX, lint, build, and Playwright tests pass.
