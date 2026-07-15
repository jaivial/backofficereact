# Plan — Member invitation/reset emails via per-restaurant config + dark app template

## Goal
1. Make **add-member invitation** and **password-reset** emails use the **per-restaurant email settings** stored in `email_provider_config` (configured at `app/config?content=contacto`), supporting both **SMTP** and **Gmail** providers — exactly like booking-confirmation emails already do.
2. Replace the plain-text body that borrows restaurant branding with a **new HTML template branded as the app "Restaurant Backoffice"** (not the restaurant), **dark-themed**, with an **override that forces dark colors in mobile email clients** (iOS Mail / Gmail / Outlook dark mode).

## Current state (verified)
- `backend/internal/api/backoffice_member_access_flows.go`
  - `sendMemberInvitation` (L646) and `sendMemberPasswordReset` (L664) build a **plain-text** body using the restaurant brand (`restaurantNameFallback`) and send email via `sendSMTPMailBestEffort` (L689).
  - `sendSMTPMailBestEffort` reads **global env vars** `SMTP_HOST/PORT/FROM/USER/PASS` — it ignores the DB config entirely.
- `backend/internal/api/booking_email.go` already does it right:
  - `resolveSMTPConfigForRestaurant` → `loadEmailProviderConfig(ctx, restaurantID)` reads DB.
  - `sendViaConfig(ctx, cfg, fromName, fromAddr, to, subject, htmlBody)` sends **HTML** and switches on `cfg.Provider` (`gmail` → smtp.gmail.com:587 tls; else SMTP host/port/encryption).
  - `smtpSend` is a **swappable package var** (`var smtpSend = smtpSendReal`) — already used by `booking_email_test.go` via `withRecordingSMTP`.
- Config struct: `boEmailProviderConfig` + `checkEmailProviderCompleteness` (`backoffice_config.go`). Branding: `boBranding{ BrandName, LogoURL, EmailFromName, EmailFromAddress }`.
- WhatsApp delivery path (`sendWhatsAppMessage`) is unrelated and stays as-is.

## Design decisions
1. **Reuse `sendViaConfig` + `loadEmailProviderConfig`** for member emails. No new SMTP plumbing; that keeps SMTP/Gmail behavior identical to booking emails and covered by the same swappable `smtpSend`.
2. **Sender identity:** email is "from the app", so the template header/footer/subject use the fixed brand **"Restaurant Backoffice"**. The technical `From:` uses the per-restaurant credentials:
   - `fromName = "Restaurant Backoffice"` (constant, app brand — NOT restaurant name).
   - `fromAddr = branding.EmailFromAddress` else `cfg.SMTPFromEmail`/`cfg.GmailFromEmail`.
   - The restaurant name still appears **inside the body** ("Te han invitado al backoffice de <restaurant>") for user context, but visual branding = app.
3. **Config missing/inactive:** do **not** fall back to env SMTP. Record the email delivery attempt as `Sent:false, Error:"email provider not configured"` so the UI's existing delivery reporting surfaces it. WhatsApp still attempts independently.
4. **Delete** `sendSMTPMailBestEffort` and its now-unused helpers (`mimeSafeSubject` if unused elsewhere) once nothing references them. Env vars `BO_INVITATION_TOKEN_TTL_HOURS` etc. are unrelated and stay.
5. New template builders live in a new file `backend/internal/api/backoffice_email_template.go`, reusing existing `htmlEscape`, `isASCII`, `base64Encode`.

## Template: dark-themed, app-branded, mobile dark override
New builders:
- `buildBackofficeInvitationEmailHTML(restaurantName, actionURL, expiresLabel string) string`
- `buildBackofficePasswordResetEmailHTML(restaurantName, actionURL, expiresLabel string) string`
- Shared `renderBackofficeEmailShell(title, introHTML, ctaLabel, ctaURL, footerNote string)`.

Dark-mode requirements baked into the shell:
- `<meta name="color-scheme" content="dark">` and `<meta name="supported-color-schemes" content="dark">`.
- `<style>` with `:root { color-scheme: dark; }` and a `@media (prefers-color-scheme: light)` block that **re-forces the dark palette** (so light-mode clients still render dark).
- Gmail/Outlook dark-mode class hooks: `[data-ogsc]` / `[data-ogsb]` overrides pinning background `#0f1115`, surface `#1a1d24`, text `#e7e9ee`, accent `#3ba88f`.
- All colors inline on elements (email-client safe) **and** duplicated in `<style>` for clients that strip inline on dark transform.
- Bulletproof CTA button (table-based) with `bgcolor` + inline styles so it survives dark transforms.
- Brand lockup shows **"Restaurant Backoffice"** wordmark (text, no restaurant logo) so it reads as an app/system email.
- Palette constants centralized in Go (`const boEmailBg = "#0f1115"`, `boEmailSurface = "#1a1d24"`, `boEmailText = "#e7e9ee"`, `boEmailMuted = "#9aa0ab"`, `boEmailAccent = "#3ba88f"`).

## TDD sequence (write failing test → implement → green)

### Backend unit tests (`backend/internal/api/backoffice_member_access_flows_test.go` — new)
Reuse existing helpers: `testDB`, `newTestServer`, `seedRestaurant`, `seedEmailProvider`, `withRecordingSMTP` (all in `*_test.go` today). Add a `seedEmailProviderGmail` variant.

1. `TestSendMemberInvitation_UsesDBSMTPConfig`
   - Arrange: seed restaurant + **active SMTP** provider row.
   - Act: `srv.sendMemberInvitation(ctx, id, "user@x.com", "", "https://bo/invitacion/tok")`.
   - Assert: exactly 1 recorded `smtpCall`; `host=smtp.titan.email`, `port=587`, `username`/`password`/`encryption` from DB; `to="user@x.com"`; `fromName="Restaurant Backoffice"`; delivery attempt `Sent=true`.
2. `TestSendMemberInvitation_UsesGmailProvider`
   - Seed **active gmail** row; assert recorded call `host=smtp.gmail.com`, `port=587`, `encryption=tls`, `username=gmailFromEmail`, `password=gmailAppPassword`.
3. `TestSendMemberInvitation_NoConfig_RecordsError`
   - No provider row (or inactive). Assert **0** smtp calls and returned delivery `[{channel:email, sent:false, error contains "email provider not configured"}]`.
4. `TestSendMemberPasswordReset_UsesDBConfig` — same three cases, mirrored.
5. `TestBackofficeInvitationEmailHTML_IsDarkAndAppBranded`
   - Assert body contains `Restaurant Backoffice`, the `actionURL`, `color-scheme` dark meta, `prefers-color-scheme`, `data-ogsc`, and the dark bg hex; assert it does **not** derive brand from restaurant name in the header.
6. `TestBackofficeEmailHTML_EscapesRestaurantName` — inject `"<script>"` restaurant name → assert escaped in body.

Run: `cd backend && go test ./internal/api/ -run 'Member|BackofficeEmail' -count=1`
(These need the test MySQL; suite already `t.Skipf`s when DB unreachable — keep that guard.)

### Implementation steps
1. Add `backoffice_email_template.go` with palette consts + shell + two builders.
2. Refactor `sendMemberInvitation`:
   ```
   cfg, err := s.loadEmailProviderConfig(ctx, restaurantID)
   ok, _ := checkEmailProviderCompleteness(cfg) // provider+active
   brand := s.restaurantNameFallback(ctx, restaurantID)   // body context only
   if email != "" {
       if !ok { record {email, sent:false, error:"email provider not configured"} }
       else {
           fromAddr := resolveFromAddr(branding, cfg)
           html := buildBackofficeInvitationEmailHTML(brand, invitationURL, expiresLabel)
           err := sendViaConfig(ctx, cfg, "Restaurant Backoffice", fromAddr, email, subject, html)
           record {email, sent: err==nil, error}
       }
   }
   // whatsapp path unchanged
   ```
   Add small helper `resolveEmailFromAddr(branding boBranding, cfg boEmailProviderConfig) string`.
3. Mirror in `sendMemberPasswordReset` with reset template + subject.
4. Delete `sendSMTPMailBestEffort` (+ `mimeSafeSubject` if unreferenced). Verify with `grep`.
5. `go build ./...` then run the unit tests.

### Playwright e2e (`backoffice/e2e/specs/miembros/member-invite-email.spec.ts` — new)
Uses the existing `fixtures/session` (`adminPage`) which reads credentials from env (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in `.env`, consumed by `global-setup.ts`). No hard-coded secrets.

Approach: drive the real UI + API, assert the **delivery report** returned by the backend reflects the per-restaurant provider (email channel present), for both provider configs. We do not assert real inbox receipt; we assert the API used the email channel and reported an attempt, plus DB config correctness.

Test A — **SMTP scenario**:
1. Configure provider via API helper: `POST /api/admin/config/email-provider` with SMTP host/port/user/pass/from/encryption=tls, `isActive:true`. (Values from env: `E2E_SMTP_HOST`, `E2E_SMTP_USER`, `E2E_SMTP_PASS`, `E2E_SMTP_FROM`; fall back to titan test values.)
2. `POST /api/admin/members` with a unique email + `roleSlug:"admin"`.
3. Assert response `invitation.created === true` and `invitation.delivery` contains an item `{channel:"email", target:<email>}`. (With a reachable SMTP it will be `sent:true`; assertion tolerates `sent` boolean but requires the **email channel exists** — proving it went through the provider path, not skipped.)
4. `POST /api/admin/members/{id}/invitation/resend` → assert `invitation.delivery` again includes the email channel.

Test B — **Gmail scenario**:
1. Configure provider via API with `provider:"gmail"`, `gmailFromEmail`, `gmailAppPassword` from env (`E2E_GMAIL_FROM`, `E2E_GMAIL_APP_PASSWORD`), `isActive:true`.
2. Create member + resend as above; assert email channel present in delivery.
3. Restore SMTP config at the end (afterAll) so other suites are unaffected.

Test C — **UI regression** (existing `create-member.spec.ts` still green): member with email creates and appears in list.

Optional DB assertion (mirrors `email-config.run.ts`): query `email_provider_config` to confirm the provider row the test wrote (guarded, skips if `mysql` CLI unavailable).

Run:
```
cd backoffice
bun run test:e2e -- e2e/specs/miembros/member-invite-email.spec.ts
# or: bunx playwright test e2e/specs/miembros/member-invite-email.spec.ts
```

### Env additions (document in `.env` / e2e docs, do not commit secrets)
```
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_SMTP_HOST=  E2E_SMTP_USER=  E2E_SMTP_PASS=  E2E_SMTP_FROM=
E2E_GMAIL_FROM=  E2E_GMAIL_APP_PASSWORD=
```

## File-by-file changes
| File | Change |
|---|---|
| `backend/internal/api/backoffice_email_template.go` | **new** — dark app-branded HTML builders + palette |
| `backend/internal/api/backoffice_member_access_flows.go` | refactor `sendMemberInvitation` + `sendMemberPasswordReset` to `loadEmailProviderConfig`+`sendViaConfig`; add `resolveEmailFromAddr`; delete `sendSMTPMailBestEffort`(+`mimeSafeSubject` if unused) |
| `backend/internal/api/backoffice_member_access_flows_test.go` | **new** — unit tests 1–6 |
| `backoffice/e2e/specs/miembros/member-invite-email.spec.ts` | **new** — SMTP + Gmail + resend e2e |
| `.env` / `backoffice/docs` | document new E2E_* vars |

## Acceptance criteria
- Invitation & reset emails send through the **restaurant's** SMTP **or** Gmail config; no code path reads `SMTP_*` env for these anymore (`grep -rn sendSMTPMailBestEffort` → none).
- When no active provider is configured, the email attempt is reported as failed with a clear reason (no silent env fallback).
- Emails render dark-themed with "Restaurant Backoffice" branding and stay dark in mobile clients (prefers-color-scheme + data-ogsc overrides).
- `go test ./internal/api/ -run 'Member|BackofficeEmail'` green; Playwright SMTP + Gmail specs green; existing `create-member.spec.ts` still green.

## Rollout order
1. Backend unit tests (red) → template + refactor (green).
2. `go build ./...`, full `go test ./internal/api/`.
3. Playwright specs against dev backoffice.
4. Manual smoke: create a member with a real inbox, confirm dark rendering on iOS Mail + Gmail app.
