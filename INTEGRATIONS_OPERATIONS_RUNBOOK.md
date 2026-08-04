# Integration Foundations — Operations Runbook

## Deploy

1. Back up production MySQL.
2. Deploy backend containing migration `067_pending_integrations_foundation.sql`.
3. Configure private storage only with a non-public Bunny storage zone:

```env
BUNNY_PRIVATE_STORAGE_ZONE=private-zone
BUNNY_PRIVATE_STORAGE_ACCESS_KEY=secret
STOCK_DOCUMENT_RETENTION_DAYS=365
```

4. Build binaries:

```bash
cd /var/www/newvillacarmen/backend
go build -o bin/server ./cmd/server
go build -o bin/ops-check ./cmd/ops-check
```

5. Install timer:

```bash
sudo cp deploy/villacarmen-ops-check.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now villacarmen-ops-check.timer
sudo systemctl start villacarmen-ops-check.service
```

6. Verify:

```bash
systemctl list-timers villacarmen-ops-check.timer
systemctl status villacarmen-ops-check.service
journalctl -u villacarmen-ops-check.service -n 100
```

## POS retry/load check

Use staging only. Create one open cash ticket, then run concurrent identical checkout
commands:

```bash
go run ./cmd/pos-load \
  -base https://localhost:3001 \
  -cookie "$BO_SESSION" \
  -ticket 123 -version 4 -amount 3250 -workers 8
```

All requests must return success/duplicate success. Verify one payment set, one stock
movement set and one cover contribution. Never run against an unintended live ticket.

## Private document verification

- Upload one OCR document.
- Confirm response has `originalRetained: true`.
- Open document and download original while authenticated.
- Anonymous/public Bunny URL must not exist.
- Delete test original; extraction/review remains.
- Check `stock_document_access_audit` contains `DOWNLOAD` and `DELETE`.

If private credentials are absent, OCR still works but reports
`originalRetained: false`.

## Scheduled operations check

`ops-check` uses MySQL `GET_LOCK`; concurrent runs skip. It audits:

- Ledger versus materialized stock differences.
- Old POS visits and shifts.
- Open stock exceptions and negative-stock anomalies.
- Paid tickets with partial stock application.
- Expired private-document retention.

Warnings return exit code `2`. Any configured tenant `n8n_webhook_url` receives
`operations.warning`. Audit never rebuilds stock automatically.

Manual rebuild remains:

```http
POST /api/admin/stock/reconciliation/rebuild
```

Run only after reviewing differences and backing up DB.

## Accounting exports

From POS Reports, download:

- `SALES_VAT`
- `PAYMENTS`
- `REFUNDS`
- `STOCK`

Response header `X-Export-SHA256` and `accounting_exports` preserve reproducibility.
Provider submission remains disabled until accountant/provider format approval.

## Reservation seating

POS table-open modal can load today's reservations. Selecting reservation prefills
covers and sends `bookingId`. One open visit per reservation is enforced. Existing
open reservation visits are recovered, not duplicated.

No-show/served status mutation remains disabled until reservation policy is signed.

## Actual production labour

Stock → Operations → Mano de obra real:

1. Select confirmed production order.
2. Select closed fichaje entry with remaining minutes.
3. Allocate integer minutes.
4. Missing compensation shows incomplete cost, never zero.
5. Delete incorrect allocation; audit row remains.

Only restaurant admins (`roleImportance >= 90`) can access these endpoints/UI.

## Rollback

- Disable timer: `sudo systemctl disable --now villacarmen-ops-check.timer`.
- Remove private storage env vars to stop retaining new originals.
- Existing private originals remain under retention policy.
- Accounting export, reservation link and labour rows remain immutable/audited.
- Do not roll back migration `067` by dropping data in production.

## Still blocked

No adapter should be enabled without named provider/legal contract:

- Fiscal/VeriFactu/TicketBAI.
- Physical card terminal.
- KDS/printer devices; own KDS/agent development waits for inventory.
- First marketplace contract. External POS ingestion is cancelled.
- Payroll/tax/Social Security submission.
- Trusted VAT source.
- Offline fiscal/payment mode.

Detailed owner steps and internal development todo: `INTEGRATIONS_OWNER_AND_DEVELOPMENT_PLAN.md`.
