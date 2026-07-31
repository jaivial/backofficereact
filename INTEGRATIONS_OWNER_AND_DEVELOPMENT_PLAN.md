# Integrations — Owner Configuration and Development Plan

> **Purpose:** separate decisions/configuration only restaurant owner can supply from software work that can be developed internally.
>
> **Key decision:** Villa Carmen uses its own POS. No third-party POS provider or external-POS ingestion is planned. Existing products, VAT, tickets, payments, tables, visits, stock movements and covers remain authoritative in Villa Carmen MySQL.
>
> **Legal boundary:** fiscal, VAT, payroll, tips and gift-card policy require written confirmation from qualified Spanish accountant/labour/legal advisers. Software will enforce approved rules; it will not invent them.

---

## 1. Scope decision

### Build internally

- Existing Villa Carmen POS rollout and hardening.
- Product/catalogue, table, ticket, split, payment-recording and refund workflows.
- Stock deductions, covers, reservations and accounting exports.
- Own browser-based Kitchen Display System (KDS).
- Own printer-dispatch service after printer protocols are known.
- Official-source VAT research and review workflow.
- Local loyalty points ledger.
- Local gift-card/account-credit ledger.
- Tips capture and allocation after policy approval.
- Payroll-input calculation and accountant-approved file export.
- Cash-only offline command journal after fiscal contingency approval.
- Multi-replica event distribution only when production runs more than one backend replica.

### External contracts still unavoidable

These are not POS providers. They perform regulated or external network work:

1. Fiscal submission/certification provider if required by approved jurisdiction policy.
2. Card acquirer/terminal provider if automated physical-card capture is wanted.
3. Delivery marketplaces only when Villa Carmen signs a marketplace contract.
4. Payroll/Social Security submission provider only when direct automated filing is wanted.

### Explicitly removed

- [x] Remove third-party POS ingestion from roadmap.
- [x] Keep Villa Carmen POS as only operational sales source.
- [x] Do not build generic POS adapter framework.
- [x] Do not synchronize products, tickets or stock from another POS.

Current implementation references:

- 📍 `../backend/internal/api/backoffice_pos.go:351` — internal POS bootstrap.
- 📍 `../backend/internal/api/backoffice_pos_catalog.go:28` — internal product catalogue.
- 📍 `../backend/internal/api/backoffice_pos_checkout.go:205` — atomic internal checkout.
- 📍 `../backend/internal/api/backoffice_pos_checkout.go:160` — stock application.
- 📍 `../backend/internal/api/backoffice_pos_checkout.go:359` — refund/restock flow.
- 📍 `../backend/internal/db/migrations/065_pos_sales.sql:122` — internal payment records.
- 📍 `../backend/internal/db/migrations/066_pos_stock_and_covers.sql:1` — immutable sale-stock snapshots.
- 📍 `pages/app/pos/pos.tsx:36` — backoffice POS screen.

---

## 2. Responsibility matrix

| Area | Owner/manual input | Development work | Default while waiting |
|---|---|---|---|
| Internal POS | Pilot restaurant, opening rules, roles, product review | Build, test, deploy and harden own POS | Stock/covers remain `SHADOW` |
| Fiscal | Written jurisdiction/rules decision; provider account if required | Fiscal state machine and approved adapter | Receipts labelled non-fiscal |
| Card terminal | Decide integrated vs standalone; obtain terminal credentials if integrated | Captured-attempt state machine and reconciliation | Record card manually, no automated charge |
| KDS | List stations/screens and workflow | Build own KDS | Existing manual kitchen process |
| Printers | Device model, connection and network details | Build local print agent and routing | KDS/manual print only |
| VAT | Restaurant tax jurisdiction and accountant-approved matrix | Build official-source research/review | Existing manually configured VAT rates |
| Marketplaces | Choose marketplace and obtain merchant/API contract | Build first provider-specific adapter | No marketplace ingestion |
| Loyalty | Consent, retention, earning/redemption policy approval | Build local append-only points ledger | Disabled |
| Gift cards | Accountant-approved liability/refund/expiry policy | Build local monetary ledger | Disabled |
| Tips | Accountant/labour-approved tax, payroll and refund rules | Build capture/allocation/reporting | Record outside automated payroll flow |
| Payroll | Approved fields/file layout; provider only if direct submission wanted | Build deterministic payroll-input export | Existing compensation/fichaje reports |
| Offline | Approve fiscal contingency, cash policy and device recovery | Build cash-only journal and conflict resolution | Online-only POS |
| Multi-replica | No manual provider choice now | Add only when second backend replica exists | Single backend replica |

---

## 3. Owner handoff rules

### Never send secrets through Git, Markdown, email or chat

For each external provider:

1. Create provider account using company-owned email.
2. Enable MFA for every administrator.
3. Create separate sandbox and production credentials.
4. Restrict credentials to minimum scopes.
5. Record provider support phone/email and contract identifier.
6. Send only non-secret provider documentation and account identifiers for development.
7. Install secrets directly in production environment when exact variable names are delivered.
8. Keep previous webhook secret during documented rotation overlap only.
9. Test sandbox first.
10. Revoke test/old credentials after production acceptance.

Do not add credentials until adapter exists. Development will provide exact environment variable names, webhook URL and verification command for each selected provider.

### Decision record format

Create one signed/approved PDF or email per regulated area containing:

```text
Restaurant legal entity:
Tax ID:
Registered tax address:
Operational restaurant address:
Tax jurisdiction/regime:
Decision owner:
Professional adviser name/company:
Decision date:
Rules approved:
Effective date:
Exceptions:
Retention requirement:
Attached source/contract:
```

Store business decisions outside public storage. Only decision metadata and approved rule snapshots enter application DB.

---

# Execution tracks

## 4. Track A — Internal Villa Carmen POS rollout

No external POS configuration required.

### Owner steps

- [ ] Choose pilot restaurant/tenant ID.
- [ ] Name one operational owner and one technical contact.
- [ ] Confirm timezone. Recommended default: `Europe/Madrid`.
- [ ] Confirm business-day cutoff. Current default: `05:00`.
- [ ] List service periods and times: lunch, dinner, other.
- [ ] Decide whether open cash shift is mandatory before checkout.
- [ ] Decide whether visit closes automatically after final ticket payment.
- [ ] Confirm receipt prefix and legal business name/address shown on non-fiscal receipt.
- [ ] List cashier, supervisor and admin users.
- [ ] Approve discount, void, refund and stock-restock permissions per role.
- [ ] Review active POS products, prices and VAT rates.
- [ ] Map top 20–30 products to stock item, warehouse and quantity.
- [ ] Count opening stock before shadow comparison.
- [ ] Record manual daily covers for comparison during shadow phase.
- [ ] Provide one TLS staging account/session for authenticated Playwright.
- [ ] Choose pilot start date and 1–2 week shadow review date.

### Development todo

- [ ] Add pilot activation checklist to POS settings UI.
- [ ] Add configuration validation for timezone, cutoff, service periods and receipt prefix.
- [ ] Add role template preview before permission save.
- [ ] Add stock-mapping coverage ranked by product sales volume.
- [ ] Run authenticated POS Playwright suite.
- [ ] Run concurrent checkout, split, refund and reload load tests.
- [ ] Add shadow comparison report for theoretical stock versus actual counts.
- [ ] Add shadow comparison report for automatic versus manual covers.
- [ ] Add explicit acceptance screen before changing covers to `LIVE`.
- [ ] Add explicit acceptance screen before changing stock to `LIVE`.
- [ ] Document emergency switches: stock `OFF`, covers `MANUAL`, POS disabled.

### Acceptance

- [ ] Zero duplicate payments under retry/load test.
- [ ] Zero duplicate stock movements.
- [ ] Zero duplicate covers from split tickets.
- [ ] All high-volume products mapped or explicitly exempted.
- [ ] Shadow differences reviewed and signed.
- [ ] Covers enabled `LIVE` first.
- [ ] Stock enabled `LIVE` only after covers stability.

---

## 5. Track B — Fiscal / VeriFactu / TicketBAI

### Owner steps — mandatory

Do not choose protocol from address alone. Ask accountant/tax adviser for written answers.

1. Provide legal entity name, NIF/CIF, registered address and restaurant address.
2. Ask which regime applies on target go-live date:
   - AEAT/VeriFactu or other common-territory rules.
   - TicketBAI in Álava, Bizkaia or Gipuzkoa.
   - Navarra-specific rules.
   - Any exemption, transition period or special billing regime.
3. Ask whether Villa Carmen software may submit directly or must use certified/provider software.
4. Ask required document types:
   - Simplified invoice/ticket.
   - Full invoice.
   - Rectification/refund document.
   - Cancellation/void rules.
5. Ask required numbering series and whether series differ by restaurant/device/document type.
6. Ask required QR, hash chain, signature/certificate and previous-record references.
7. Ask synchronous versus asynchronous submission deadline.
8. Ask outage/contingency procedure and later recovery sequence.
9. Ask data-retention period and required audit/export format.
10. Obtain two approved samples: normal paid ticket and partial refund/rectification.
11. If provider required, compare providers using:
    - Jurisdiction certification.
    - Sandbox quality.
    - Webhook/poll support.
    - Idempotency.
    - Refund/rectification support.
    - Pricing and SLA.
    - EU data processing terms.
12. Sign provider contract only after sample payload/receipt requirements are available.
13. Supply development with documentation URLs, sandbox account ID, webhook signing method and non-secret sample payloads.
14. Install sandbox/production secrets only after variable names are provided.

### Development todo

- [ ] Convert approved legal answers into effective-dated tenant fiscal policy.
- [ ] Add immutable fiscal document and provider-event schema.
- [ ] Build deterministic payload from paid ticket/VAT/payment snapshots.
- [ ] Add sale and rectification numbering with tenant-safe locking.
- [ ] Keep `paymentStatus` independent from `fiscalStatus`.
- [ ] Add `PENDING`, `SUBMITTING`, `ACCEPTED`, `REJECTED` and contingency states.
- [ ] Implement first approved fiscal provider only; no generic framework.
- [ ] Verify webhook signature, timestamp, body size and event uniqueness.
- [ ] Add retry/reconciliation job outside checkout transaction.
- [ ] Add accepted QR/reference to receipt only when legal policy allows.
- [ ] Add rejected/pending queue and admin recovery UI.
- [ ] Add refund rectification without modifying original accepted document.
- [ ] Add duplicate, retry, outage, cross-tenant and immutable-hash tests.
- [ ] Run provider certification suite and accountant sample review.

### Default while waiting

- POS remains usable for internal operational testing.
- Receipt must say non-fiscal/provisional wording approved for testing.
- No document is described as legally fiscal.
- No invented QR, hash or certification mark.

### Acceptance

- [ ] Written jurisdiction decision attached.
- [ ] Provider/direct-submission route approved.
- [ ] Normal sale and refund samples accepted.
- [ ] Outage drill passed without duplicate payment or fiscal record.
- [ ] Accountant/legal sign-off recorded.

---

## 6. Track C — Card terminal/acquirer

Card terminal provider is payment rail, not POS provider. Villa Carmen POS remains authoritative.

### Owner choice

Choose one:

- **Option 1 — Standalone terminal:** cashier charges on bank terminal, then records `CARD` in Villa Carmen POS. No API integration. Fastest path.
- **Option 2 — Integrated terminal:** Villa Carmen sends amount to terminal and verifies capture by provider webhook/poll. Requires acquirer API contract.

### Owner steps for standalone terminal

- [ ] Obtain terminal from bank/acquirer.
- [ ] Configure merchant account and settlement bank account.
- [ ] Train cashier to compare terminal amount with POS amount.
- [ ] Require terminal receipt/reference when recording manual card payment.
- [ ] Define end-of-shift settlement comparison owner.
- [ ] Define process for terminal-approved payment when POS completion fails.
- [ ] Define refund process: terminal refund first, then local POS refund.

No development blocker beyond adding optional provider reference and reconciliation UX.

### Owner steps for integrated terminal

1. Ask bank/acquirer whether terminal has cloud or local API.
2. Obtain exact terminal model and serial/device ID.
3. Obtain sandbox terminal or simulator.
4. Obtain API docs, webhook docs and status-transition table.
5. Confirm capture, cancellation, refund and partial-payment support.
6. Confirm timeout and late-capture behavior.
7. Confirm settlement/report API and settlement timezone.
8. Confirm webhook signing and IP/network requirements.
9. Confirm terminal can be mapped to one restaurant and one physical station.
10. Create restricted sandbox credentials.
11. Supply docs and non-secret IDs to development.
12. Configure production secrets only after sandbox tests pass.
13. Run one terminal/one cashier pilot for ten business days.

### Development todo

- [ ] Keep standalone `CARD` recording available and permission-gated.
- [ ] Add optional terminal/provider reference to manual card workflow.
- [ ] Add daily POS-versus-terminal settlement report.
- [ ] For integrated option, add local payment-attempt state machine.
- [ ] Never store PAN or CVV.
- [ ] Prevent second charge while attempt is `UNKNOWN`.
- [ ] Consume captured attempt once during checkout.
- [ ] Add provider-confirmed refund before local card refund completion.
- [ ] Add webhook verification and scheduled poll/reconciliation.
- [ ] Add cashier UI for waiting, captured, declined and unknown states.
- [ ] Test late capture, duplicate callback, split payment and lost response.

### Default while waiting

Use standalone terminal/manual `CARD` record. No automated terminal call. Payment reference can be entered manually.

---

## 7. Track D — Own KDS and printer routing

No KDS provider required. Build browser-based KDS against Villa Carmen backend.

### Owner steps — KDS workflow

1. Walk through kitchen/bar and name each preparation station.
2. Recommended starting list: hot kitchen, cold kitchen, bar, desserts/pass.
3. For each station record:
   - Display name.
   - Products/categories prepared there.
   - Screen location.
   - Network availability.
   - Whether staff acknowledge, start and mark ready.
4. Decide when order is sent:
   - Explicit **Send to kitchen** button, recommended.
   - Automatic send on line add, not recommended for first pilot.
5. Decide whether additions/voids require supervisor reason.
6. Decide ticket grouping: by table, course, service or dispatch time.
7. Decide sound/visual alert rules.
8. Decide completed-ticket retention on screen.
9. Buy or assign one browser-capable screen/tablet per required station.
10. Ensure each device has stable power, local Wi-Fi/Ethernet and kiosk browser support.

### Owner steps — printers

For every printer provide:

```text
Station:
Manufacturer/model:
Connection: Ethernet / Wi-Fi / USB / Bluetooth:
IP address if networked:
Paper width: 58mm / 80mm:
Protocol/manual URL:
ESC/POS supported: yes/no/unknown:
Cutter: yes/no:
Cash drawer attached: yes/no:
Character encoding/language:
Test computer operating system:
```

Then:

1. Assign DHCP reservation/static IP to every network printer.
2. Place printers on trusted restaurant LAN; never expose raw printer ports publicly.
3. Print manufacturer self-test page and keep protocol/firmware details.
4. Choose one always-on local computer/Raspberry Pi only if printer needs USB/local access.
5. Define paper-out/device-down manual fallback.

### Development todo — KDS

- [ ] Add station and route schema scoped by `restaurant_id`.
- [ ] Add immutable dispatch and dispatch-line deltas.
- [ ] Add explicit **Send to kitchen** action.
- [ ] Route product/category snapshots to one or more stations.
- [ ] Build KDS route with pending, acknowledged, preparing and ready states.
- [ ] Add elapsed timers and accessible sound/visual alerts.
- [ ] Send explicit ADD/VOID/NOTE/FIRE deltas after initial dispatch.
- [ ] Reconnect and replay unacknowledged dispatches idempotently.
- [ ] Add station/device health screen.
- [ ] Keep checkout independent from KDS availability.

### Development todo — printer agent

- [ ] Select smallest protocol from supplied hardware: network ESC/POS, CUPS or vendor API.
- [ ] Build local outbound/polling agent; no inbound public LAN port.
- [ ] Authenticate agent per restaurant/device.
- [ ] Render deterministic kitchen and customer receipt layouts.
- [ ] Acknowledge dispatch ID once.
- [ ] Add retry, paper-out and offline status.
- [ ] Add test-print action.
- [ ] Run shadow print beside current process before cutover.

### Acceptance

- [ ] Correct products reach correct stations.
- [ ] Edit/void sends delta, not duplicate full order.
- [ ] Device reconnect does not duplicate ticket.
- [ ] KDS/printer failure never blocks payment.
- [ ] Manual kitchen fallback documented.

---

## 8. Track E — Trusted VAT source

No generic AI/search provider required for authority. Build around official sources plus human approval.

### Owner steps

1. Supply restaurant legal/tax jurisdiction from fiscal decision.
2. Ask accountant for current VAT matrix covering at least:
   - Food consumed on premises.
   - Takeaway food.
   - Non-alcoholic drinks.
   - Alcoholic drinks.
   - Delivery/service charges if used.
   - Gift-card issuance/redemption treatment.
   - Tips/service charges if used.
3. For each row require rate, effective date, legal source URL/document and exceptions.
4. Approve whether historical product VAT changes should affect only future tickets.
5. Name VAT-review owner.
6. Define review frequency: monthly source check plus immediate legal-change review recommended.
7. Upload/source official BOE, AEAT or competent foral authority references. Do not use blogs as authority.

### Development todo

- [ ] Add effective-dated jurisdiction/source registry.
- [ ] Add official-source URL and snapshot hash.
- [ ] Add candidate VAT research report and expiry.
- [ ] Allow optional AI summary only after official text retrieval.
- [ ] Block VAT mutation from AI/research job.
- [ ] Require admin preview/confirm to apply rate.
- [ ] Keep existing paid-ticket VAT snapshots immutable.
- [ ] Show stale source/effective-date warnings.
- [ ] Add scheduled source-change detection where official endpoint/feed permits it.
- [ ] Add product impact preview before bulk future-rate update.

### Default while waiting

Use existing manually configured VAT rates. No automated recommendation applies changes.

---

## 9. Track F — Delivery marketplaces; no external POS

Marketplace integration is optional. External POS integration is cancelled.

### Owner steps per marketplace

1. Choose first marketplace only: Glovo, Uber Eats, Just Eat or other.
2. Sign merchant/API contract.
3. Confirm API access is included; merchant dashboard access alone may be insufficient.
4. Obtain webhook, order, cancellation/refund and menu API docs.
5. Obtain sandbox/test-store account.
6. Confirm whether marketplace is merchant of record or only intermediary.
7. Confirm commission, taxes, settlement, refund and cancellation fields.
8. Export marketplace product IDs and modifier IDs.
9. Approve mapping to Villa Carmen POS products.
10. Decide stock deduction point: accepted paid order recommended.
11. Decide who accepts/rejects order and expected timeout.
12. Configure production credentials only after inbound pilot passes.

### Development todo

- [ ] Do nothing until first marketplace contract exists.
- [ ] Build provider-specific signed webhook inbox.
- [ ] Add unique external order/event IDs and replay protection.
- [ ] Add product/modifier mapping preview.
- [ ] Create delivery visit/ticket in internal POS; covers always zero.
- [ ] Reuse internal checkout stock snapshots and movements.
- [ ] Record commission/settlement separately from ticket gross.
- [ ] Map cancellation/refund to append-only local correction.
- [ ] Pilot inbound orders first.
- [ ] Add outbound availability/menu sync only after two stable weeks.

### Explicit non-todo

- [x] No external POS provider selection.
- [x] No external POS sale ingestion.
- [x] No shared generic sales-adapter framework.

---

## 10. Track G — Loyalty

### Owner steps

1. Define customer identifier: phone, email, QR/member code or combination.
2. Ask privacy adviser for lawful basis and exact consent text.
3. Define purpose: points, offers, visit history or all separately.
4. Define minimum collected fields.
5. Define retention after inactivity.
6. Define erasure/anonymization process while retaining legally required financial history.
7. Define points earning rule, for example points per euro.
8. Define redemption value and minimum balance.
9. Define expiry and notification period.
10. Define excluded products/channels and whether discounts reduce earned points.
11. Define refund reversal and manual adjustment permissions.
12. Approve customer merge/duplicate-account process.

### Recommended initial policy for approval

- Opt-in only.
- Phone or email plus opaque member ID.
- Points earned after ticket becomes paid.
- Refund reverses proportional earned points.
- Points cannot create negative balance.
- No automatic marketing consent from loyalty enrollment.
- Financial ticket remains; unnecessary profile data can be anonymized.

### Development todo

- [ ] Add tenant-scoped loyalty account and append-only point movement tables.
- [ ] Hash lookup identifiers where practical; encrypt sensitive profile fields.
- [ ] Add consent version/timestamp/source records.
- [ ] Add earn, redeem, expire, reverse and admin-adjust commands.
- [ ] Make redemption and checkout atomic.
- [ ] Add refund reversal.
- [ ] Add account merge with audit.
- [ ] Add privacy export/anonymization workflow.
- [ ] Add balance/reconciliation report.
- [ ] Add POS customer lookup and redemption UI.

---

## 11. Track H — Gift cards/account credit

### Owner steps

Ask accountant/legal adviser for written answers:

1. Is issuance single-purpose or multi-purpose voucher under applicable VAT rules?
2. When is VAT recognized: issue or redemption?
3. Which liability account/code is used?
4. Are cards refundable for cash?
5. Can refunds return to gift balance?
6. Is partial redemption allowed?
7. Can multiple gift cards pay one ticket?
8. Expiry allowed? If yes, duration and customer notice.
9. Treatment of expired/breakage balance.
10. Transferability and lost-code replacement rules.
11. Maximum issue/balance/transaction values and fraud controls.
12. Channels allowed: restaurant only or online too.
13. Approve receipt/accounting export examples for issue, redeem, refund and expiry.

### Recommended technical defaults for approval

- EUR only.
- Local Villa Carmen liability ledger.
- Partial redemption allowed.
- No negative balance.
- Raw reusable code shown once, then only secure hash stored.
- Issue/redeem/refund/adjust/expire are append-only movements.
- Redemption shares checkout transaction.
- Admin adjustment requires reason and audit.

### Development todo

- [ ] Add gift account and append-only monetary movement schema.
- [ ] Generate cryptographically random code and store secure hash only.
- [ ] Add issue, redeem, refund, adjust, expire and disable commands.
- [ ] Lock account during concurrent redemption.
- [ ] Add gift payment method to split checkout.
- [ ] Add printable/sendable gift receipt without exposing stored raw code later.
- [ ] Add liability, redemption and expiry accounting exports.
- [ ] Add fraud limits and permission gates from approved policy.
- [ ] Add balance lookup and support audit.

---

## 12. Track I — Tips and service charges

### Owner steps

Obtain written accountant and labour-adviser policy:

1. Are tips voluntary, mandatory service charge or both?
2. Are amounts part of taxable ticket base/VAT?
3. Are card-acquirer fees deducted before staff allocation?
4. Who legally receives/holds the amount before distribution?
5. How are cash tips recorded?
6. How are card tips settled?
7. Allocation rule: equal, hours worked, role, shift, pool or manual.
8. Allocation period: shift, day, week or payroll month.
9. Eligibility rules and handling of absent/new/leaving staff.
10. Employer/social-security/payroll treatment.
11. Refund behavior for tip and service charge.
12. Rounding/remainder owner.
13. Payslip and accounting account requirements.
14. Approval roles for manual corrections.

### Development todo

- [ ] Keep tips separate from sales revenue and labour cost.
- [ ] Add gratuity record linked to payment/ticket.
- [ ] Add immutable allocation rule snapshot.
- [ ] Add allocation preview and approval.
- [ ] Support cash/card source distinction.
- [ ] Add refund reversal according to approved rule.
- [ ] Add member allocation report.
- [ ] Include approved values in payroll-input export only after sign-off.
- [ ] Add accounting export for collected/payable/distributed balances.

### Default while waiting

Do not automate distribution or payroll. Record operational notes outside calculated salary totals.

---

## 13. Track J — Payroll and Social Security

### Owner choice

Choose one:

- **Phase 1 — Accountant file export:** Villa Carmen calculates approved inputs and exports CSV/XLSX. Accountant performs payroll/statutory submission. Recommended first.
- **Phase 2 — Provider API:** direct payslip/payroll/Social Security provider integration. Optional later.

### Owner steps for Phase 1

1. Ask payroll accountant for exact monthly import template.
2. Obtain field definitions, encoding, delimiter, decimal/date formats and sample file.
3. Obtain stable external employee ID for every member.
4. Define payroll period cutoff and late-correction process.
5. Define ordinary, overtime, night, holiday and absence fields.
6. Define compensation components and employer-cost fields allowed in export.
7. Confirm treatment of tips/service charges.
8. Confirm who may generate, download and approve export.
9. Confirm encryption/secure-transfer method.
10. Confirm retention and deletion period.
11. Ask accountant to validate two parallel monthly exports before production use.

### Owner steps for Phase 2

1. Select provider only after Phase 1 is stable.
2. Confirm Spanish payroll and Social Security coverage.
3. Obtain API, sandbox, webhook and correction docs.
4. Confirm payslip storage/delivery and employee access.
5. Confirm filing responsibility and provider SLA.
6. Sign processor agreement.
7. Configure sandbox/production credentials after adapter tests.

### Development todo

- [ ] Build effective-dated payroll policy input model from approved rules.
- [ ] Build deterministic monthly payroll-input calculation.
- [ ] Preserve missing compensation as blocking error, never zero.
- [ ] Add ordinary hours, approved premiums, absences and approved tips fields.
- [ ] Add preview, validation, approval and immutable export hash.
- [ ] Restrict salary/export endpoints to admin payroll permission.
- [ ] Audit generate/download/delete actions.
- [ ] Encrypt export at rest if retained.
- [ ] Add correction export rather than rewriting approved export.
- [ ] Implement provider API only after Phase 1 acceptance and real contract.

---

## 14. Track K — Offline fiscal/payment policy

Offline mode is not a normal configuration toggle. It changes financial/fiscal risk.

### Owner steps

1. Measure outages for at least 30 days: duration, frequency and affected devices.
2. Record number of simultaneous POS terminals.
3. Ask fiscal adviser for approved outage/contingency receipt and recovery sequence.
4. Ask card acquirer whether offline card capture exists and who bears fraud risk.
5. Recommended first policy: cash-only offline; card unavailable unless provider explicitly approves.
6. Define maximum offline duration.
7. Define maximum cash ticket amount offline.
8. Define cached catalogue validity period.
9. Define supervisor actions for stale price/VAT warning.
10. Define same-table conflict resolution.
11. Define device loss/browser-storage corruption procedure.
12. Define who may start/end offline mode.
13. Approve controlled network-cut drill and recovery checklist.

### Development todo after approval

- [ ] Add terminal registration and public-key identity.
- [ ] Add service worker and encrypted/local IndexedDB command journal.
- [ ] Add monotonic per-terminal sequence and unique command ID.
- [ ] Cache versioned catalogue/settings/permissions with expiry.
- [ ] Support cash-only offline ticket path first.
- [ ] Sync commands idempotently to authoritative MySQL.
- [ ] Add explicit conflict queue; no silent last-write-wins.
- [ ] Apply stock once after server accepts sale.
- [ ] Add fiscal contingency numbering from approved policy.
- [ ] Add device reset/recovery without silently deleting unsynced commands.
- [ ] Run partition, replay, reorder and corruption tests.

### Default while waiting

Online-only POS. Network failure blocks new finalization; existing server data remains safe.

---

## 15. Track L — Multi-replica backend/pub-sub

No owner configuration needed now. Current single backend replica does not need Redis/NATS.

### Automatic start gate

Start only when one of these becomes true:

- Production intentionally runs two or more backend processes serving same tenants.
- High availability/load design requires traffic to multiple live replicas.
- Measured WebSocket/event loss occurs because clients land on different replicas.

### Development todo when gate fires

- [ ] Record replica count, load balancer behavior and current event hubs.
- [ ] Prefer already-operated shared service; add Redis/NATS only if none exists.
- [ ] Keep MySQL authoritative.
- [ ] Publish tenant, event ID, type, entity/version and occurrence time only.
- [ ] Refetch authoritative state after notification.
- [ ] Ignore duplicate event IDs.
- [ ] Keep payment, stock and cover correctness independent from pub/sub.
- [ ] Test replica loss, duplicate delivery, reconnect and rolling deploy.
- [ ] Add health/lag monitoring.

### Current decision

- [x] Stay single-replica.
- [x] Do not add Redis/NATS now.
- [x] Revisit only with measured scaling/availability need.

---

# Prioritized implementation backlog

## Phase 0 — Owner can start now

- [ ] Complete Internal POS owner checklist.
- [ ] Obtain fiscal jurisdiction memo.
- [ ] Choose standalone or integrated card terminal.
- [ ] Inventory KDS stations/screens and printers.
- [ ] Obtain accountant VAT matrix.
- [ ] Decide whether any marketplace is in scope.
- [ ] Obtain loyalty privacy/retention approval.
- [ ] Obtain gift-card accounting policy.
- [ ] Obtain tips/payroll legal policy.
- [ ] Obtain payroll accountant file template.
- [ ] Measure connectivity outages; do not approve offline from guesswork.

## Phase 1 — Development without new provider contracts

- [ ] Finish internal POS pilot hardening and shadow acceptance tools.
- [ ] Build own KDS.
- [ ] Build printer routing after hardware inventory.
- [ ] Build official-source VAT review workflow after jurisdiction matrix.
- [ ] Build loyalty after consent/policy approval.
- [ ] Build gift cards after liability policy approval.
- [ ] Build tips after tax/labour policy approval.
- [ ] Build deterministic payroll export after file template approval.

## Phase 2 — External adapter work

- [ ] Fiscal adapter after legal decision/provider sandbox.
- [ ] Integrated terminal adapter only if standalone flow is rejected.
- [ ] First marketplace adapter only after contract.
- [ ] Payroll provider API only after stable approved file exports.

## Phase 3 — Conditional infrastructure

- [ ] Cash-only offline after measured need and contingency approval.
- [ ] Multi-replica pub/sub after second live backend replica.

---

## 16. Required owner response template

Copy, fill and return this section. Secrets excluded.

```text
PILOT POS
Restaurant/tenant:
Operational owner:
Pilot date:
Timezone:
Business cutoff:
Open shift required: yes/no
Auto-close visit: yes/no
Receipt prefix:
Shadow review date:

FISCAL
Legal entity/NIF:
Jurisdiction confirmed by:
Applicable system/rule:
Provider/direct submission:
Decision document available: yes/no
Sandbox docs URL:

CARD
Standalone or integrated:
Acquirer:
Terminal model:
Sandbox available: yes/no
API docs URL:

KDS/PRINTERS
Stations:
Screens/devices:
Printer inventory attached: yes/no
Send-to-kitchen workflow approved: yes/no

VAT
Accountant matrix attached: yes/no
Official sources attached: yes/no
VAT review owner:

MARKETPLACE
In scope: yes/no
First marketplace:
API contract available: yes/no

LOYALTY
In scope: yes/no
Consent approved: yes/no
Retention period:
Earn/redeem/expiry rule:

GIFT CARDS
In scope: yes/no
Accounting policy approved: yes/no
Expiry/refund rules:

TIPS
In scope: yes/no
Tax/labour policy approved: yes/no
Allocation rule:

PAYROLL
Phase 1 export template attached: yes/no
Payroll owner/accountant:
Direct provider later: yes/no

OFFLINE
Measured outage report available: yes/no
Cash-only contingency approved: yes/no
Maximum offline duration:

MULTI-REPLICA
Current backend replicas: 1
Planned second replica: yes/no/date
```

---

## 17. Global definition of done

Every delivered track must satisfy:

- [ ] Every row/query/callback scoped by `restaurant_id`.
- [ ] Integer cents for money.
- [ ] Append-only financial, stock, points, gift and audit movements.
- [ ] Idempotent mutation commands and provider events.
- [ ] External calls outside local checkout transaction.
- [ ] No duplicate payment after retry/timeout.
- [ ] No PAN, CVV, secret, salary or private document in logs.
- [ ] AI never authoritatively changes VAT, fiscal, payroll or accounting state.
- [ ] Human review for regulated rule changes.
- [ ] Cross-tenant, duplicate, replay and concurrency tests.
- [ ] Health/reconciliation and manual recovery path.
- [ ] Rollback disables new work without deleting immutable history.
- [ ] Go tests/vet/build pass.
- [ ] MySQL migration/integration tests pass.
- [ ] JSX/type/ESLint/Vitest/build pass.
- [ ] Pilot owner signs acceptance.

Related plans:

- `PENDING_INTEGRATIONS_PLAN.md` — technical integration architecture.
- `POS_IMPLEMENTATION_PLAN.md` — internal POS design.
- `POS_IMPLEMENTATION_STATUS.md` — delivered POS status.
- `INTEGRATIONS_OPERATIONS_RUNBOOK.md` — delivered foundation deployment.
