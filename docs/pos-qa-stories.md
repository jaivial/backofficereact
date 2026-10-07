# POS (TPV) — QA user stories and edge cases

Scope: `pages/app/pos` of the Backoffice APP (`/app/pos`), dev environment
`https://backoffice-dev.menustudioai.com`, DB `newvillacarmen_dev`.

Each story is written as **given / when / then** with the edge cases that must
hold. Stories were walked either manually with the `cu` browser (snapshot +
text reads of the real rendered page) or with Playwright layout probes
(`getBoundingClientRect` / computed styles) at the six viewports listed in
"Viewports".

## Viewports

| name                  | width x height | notes                        |
| --------------------- | -------------- | ---------------------------- |
| phone                 | 390 x 844      | touch                        |
| tablet portrait       | 768 x 1024     | touch                        |
| tablet landscape      | 1024 x 768     | touch                        |
| small laptop          | 1280 x 720     | low vertical space           |
| desktop               | 1920 x 1080    |                              |
| landscape tablet      | 1180 x 820     | touch                        |

## Legend

- **S** = story, **E** = edge case attached to that story.
- Status was recorded during the QA pass; see `docs/pos-qa-result` in the run
  report for the measured outcome.

---

## 1. Cash day / turno (start and end of day)

**S1.1** Given a day with no till, when the POS loads, then the operator sees
the open-day gate with the business date resolved by the backend.
- E1.1a Malformed `?date=` (e.g. `?date=abc`) falls back to the backend date
  instead of showing an empty till.
- E1.1b A date in the future is still openable (no silent redirect).

**S1.2** Given the gate, when the operator types the opening float and opens the
day, then the sell screen unlocks and the day is `OPEN` in `pos_cash_days`.

**S1.3** Given previous days are still open, when the operator opens today, then
a non-dismissable gate lists them with date, opening time, user, invoiced and
covers, and offers "Ver día" / "Abrir día igualmente" / "Ir a Informes".
- E1.3a Force-open asks for a second confirmation.
- E1.3b The backend records `forced_open`.
- E1.3c **The page must still render server-side** (the sell screen must be in
  the SSR payload). → *found bug: SSR crash, fixed*.

**S1.4** Given a day with no cash activity, when the operator picks a date with
no till, then the no-cash-day modal explains it instead of failing silently.

**S1.5** Given open visits or shifts, when the operator opens the POS, then the
health banner shows `+24 h` shifts and `+12 h` visits with links to the stock
section for anomalies/exceptions.

**S1.6** Given the day is closed, when the operator reopens a past date, then
the screen is read-only ("Día cerrado: solo consulta") and every mutating rail
action is disabled with a reason.

**S1.7** Given the day is closed with a discrepancy, when the operator enters
counted cash different from the computed cash, then closing requires a
discrepancy reason and the closure is stored.

## 2. Mesa / visitas

**S2.1** Given the POS with no open visit, when the operator opens "Mesa", then
the table map shows areas ("Todos", each salón) and every table with name,
capacity and occupancy.

**S2.2** Given a free table, when the operator picks it, sets comensales and
confirms, then a visit + ticket `TPV-YYYYMMDD-NNNN` is created and selected.
- E2.2a Default comensales is 2.
- E2.2b Comensales accept 0 and large values without breaking totals.

**S2.3** Given an occupied table, when the operator taps it, then the existing
visit is restored (lines, totals, kitchen sent state) instead of a new visit.

**S2.4** Given an open visit on table A, when the operator picks table B from the
map, then the visit moves to B with a confirmation message.

**S2.5** Given reservations for today, when the tables modal opens, then pending
reservations are offered with party size and can be attached to the visit.

**S2.6** Given a parked (aparcar) comanda, when the operator reopens the map,
then the parked list shows age ("42 min", "2 h 05 min") and can be restored.

**S2.7** Given "Para llevar" (takeaway), when the operator uses it with no open
visit, then a takeaway visit opens without a table.

**S2.8** Given "Barra" and "Salón", when used with an open visit, then the UI
explains that there is already an open account instead of silently doing nothing.

## 3. Comanda (ticket lines)

**S3.1** Given a ticket, when the operator taps a product tile, then a line is
added with qty 1 and the ticket total updates.

**S3.2** Given a line, when the operator uses +/− on the line, then quantity
changes; at qty 1 "−" becomes "Anular".

**S3.3** Given a line, when the operator selects it, then the keypad quantity
applies to that line only (selection is inspection, never a price override).

**S3.4** Given the keypad in "quantity" context, when the operator types a number
and presses OK, then the line quantity becomes that number.
- E3.4a 0 or empty does nothing (never sets quantity 0 silently).
- E3.4b Very large quantities (e.g. 999) are accepted and totals stay coherent.

**S3.5** Given a line, when the operator voids it, then a confirmation is asked,
the line is `VOIDED` and the total drops.

**S3.6** Given several lines, when they are added, then the most recent line is
visually marked (recency highlight).

**S3.7** Given a product with a very long name, when the tile renders, then the
name is clamped to two lines and the price stays visible.

**S3.8** Given a ticket with 0 lines, when the panel renders, then it shows an
explicit empty state ("No hay líneas en la cuenta"), never a blank box.

## 4. Modificadores, notas, tags, invitada

**S4.1** Given a line, when the operator sets a "Comentario", then the note is
stored and shown on the line and on the comanda PDF.

**S4.2** Given a line, when the operator toggles tags, then the tag chips update
and are persisted per line.

**S4.3** Given a line, when the operator marks "Invita" (comp), then the line is
flagged as invited with the reason and excluded from the amount due.

**S4.4** Given products with modifier groups, the operator can pick options and
the price adjusts.
- E4.4a Products without modifier groups must not show a broken modifier step.

## 5. Descuentos y recargos

**S5.1** Given a ticket, when a euro discount with reason is applied, then the
total drops and the reason is stored in `pos_ticket_adjustments`.

**S5.2** Given a ticket, when a percentage discount is applied, then the amount is
computed on the current total.
- E5.2a Percentage above 100 is clamped to 100.
- E5.2a Discount 0 / negative does nothing.
- E5.2b Discount larger than the total does not produce a negative payable.

**S5.3** Given a ticket, when a surcharge (recargo) amount/percent is applied, the
total grows and is stored as an adjustment.

## 6. Separar / dividir / juntar cuentas

**S6.1** Given a visit, when the operator splits the comanda, then a new empty
ticket is created in the same visit and the tab bar shows both.

**S6.2** Given two split tickets, when a line is moved, then quantity can be
partial and both tickets recalculate.

**S6.3** Given several split tickets, when merging, then all lines move to the
current ticket and the empty sources are voided.

**S6.4** Given "Dividir comanda", when the operator picks N comensales, then the
per-head share is computed and the remainder is distributed without losing
cents.

**S6.5** Given two open dine-in visits, when the operator joins tables, then the
visits merge and lines keep their identity.

## 7. Cobro (checkout)

**S7.1** Given a ticket, when the operator opens "Total", then the checkout shows
total to charge, delivered, pending, change and the tender list.

**S7.2** Given cash, when the operator enters the delivered amount, then the
change is computed and shown, and over-delivery is explicitly flagged.

**S7.3** Given card, when a terminal reference is required and missing, then the
checkout is refused with an explicit message (never silently).

**S7.4** Given split tenders (cash + card + Bizum + transfer), when each line is
filled, then "Completar" fills exactly what the other lines leave open.

**S7.5** Given a tip (propina), when it is set, then the total to charge grows by
the tip and the tip is stored separately from the sale.

**S7.6** Given a completed sale, then the ticket is `PAID`, the visit closes, the
ticket number is shown as "Recibo no fiscal" with a print action, and the till
is cleared.
- E7.6a Replaying the same checkout (double tap / lost response) must be
  idempotent, not a second charge.
- E7.6b With stock mode SHADOW/LIVE the message states what happened to stock.

**S7.7** Given a 0,00 € ticket, when the operator checks out, the flow completes
with a zero payment instead of dividing by zero or hanging.

## 8. Anulaciones, refunds y permisos

**S8.1** Given a line, when the operator without `pos.line.void` tries to void,
then the action is refused with the permission reason.

**S8.2** Given a discount without `pos.discount`, the action is refused.

**S8.3** Given a paid ticket, when a refund is issued, then the refund and its
lines are stored, the amounts are visible in reports and stock is restored.

**S8.4** Given "Borrar comanda" (void order), a confirmation with a reason is
required before the whole ticket is voided.

## 9. Cocina / impresión

**S9.1** Given a ticket with pending lines, when the operator sends to kitchen,
the dispatch is created per route/station and the sent quantities are remembered
per line.

**S9.2** Given the kitchen display, when a dispatch arrives, then it appears in
the station queue with age, and status can be advanced.

**S9.3** Given a ticket, when the operator prints/downloads the comanda PDF, the
PDF carries restaurant, ticket number, operator, table, covers, tags, notes and
lines.

**S9.4** Given no printer, the download still works and the failure message is
explicit.

## 10. Informes, caja y cierre

**S10.1** Given the reports section, then sales by day/service, automatic covers,
accounting CSV exports (SALES_VAT, PAYMENTS, REFUNDS, STOCK) and admin panels
are available.

**S10.2** Given an open shift, when the operator opens "Cierre X" or "Cierre Y",
then a preview with the reading is shown; Z stays on the reports card and needs
counted cash.

**S10.3** Given "Cerrar día" with open tables, the day close is blocked with a
count of pending tables and "Cerrar mesas" (bulk checkout) is offered.

**S10.4** Given "Cerrar mesas" (bulk close), then every open ticket for the date
is paid with the chosen method and the summary shows closed/skipped counts.

**S10.5** Given counted cash ≠ computed cash, then a discrepancy reason is
mandatory.

**S10.6** Given cash movements (cajón: entrada/salida/fondo), the drawer report
reconciles them.

## 11. Clientes, empleados, datos fiscales

**S11.1** Given "Cliente", then name and NIF/CIF are stored on the visit and
validated (Spanish tax id format).

**S11.2** Given "Empleado" (operator of the ticket), then the ticket records which
staff member served it.

**S11.3** Given invoices (Facturación), the ticket can be turned into a document
with the proper series/number.

## 12. Roles y permisos

**S12.1** Given a role without POS access, the POS entry is not offered.
**S12.2** Given a role without `pos.checkout`, the till is sell-only.
**S12.3** Given the POS feature disabled (`pos_pack`), the routes answer with a
clear error instead of a blank screen.

## 13. Estados de error y red

**S13.1** Given a network failure during any mutation, the error is shown in a
toast, the screen keeps its data and a retry is possible.
**S13.2** Given double taps, the in-flight guard prevents duplicate charges/moves.
**S13.3** Given an expired session, the user is returned to login.

## 14. Responsive / visual

**S14.1** The whole till fits the viewport height on every supported size: no
page-level vertical scrolling, and every rail action (including Cierre X/Y and
Cerrar día) is reachable without scrolling the document.
- E14.1a At 1024x768, 1180x820 and 1280x720 the rail buttons were measured at
  y = 750..1112 px, i.e. below the fold → *found bug*.
- E14.1b No horizontal overflow at any size (measured `scrollWidth ===
  clientWidth`).

**S14.2** Touch targets: interactive controls are at least 44 px tall on touch
viewports.
- E14.2a Keypad keys and rail buttons drop to 40 px at short viewports →
  *found bug*.

**S14.3** The table map button announces the table name and capacity (not a
concatenation such as "14 plazas" for table 1 with 4 seats).
- E14.3a *found bug*: accessible name of table 1 with capacity 4 is "14 plazas".

**S14.4** The catalog, categories and product tiles remain readable at 390 px.

**S14.5** The POS page must render server-side (SSR) even when the cash-day gate
is displayed; an SSR error must never blank the sell screen.
- E14.5a *found bug*: `createPortal(..., document.getElementById("bo-portal"))`
  ran during render in the cash-day modals → "document is not defined".
