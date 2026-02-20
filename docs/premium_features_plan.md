# Premium Features Implementation Plan (`backofficereact` + backend services)

## 1) Scope and outcome

Goal: implement Premium features end-to-end and make them production-ready with clear ownership, contracts, and validation:

1. AI Website Builder + templates
2. Cloudflare domain search/registration with 1.5x markup
3. Table manager using React Flow with live table status updates
4. WhatsApp messaging for staff via Uazapi

Notes:
- This repo is **backofficereact** (frontend). Backend/API implementation is expected in the paired backend service repo (same production stack).
- No secrets are stored in this repository. Runtime secrets come from environment/secret store.
- Use incremental delivery: backend contract first, then frontend integration, then UI polish.

## 2) Pre-conditions and assumptions

1. Tenant model exists and every premium feature call includes tenant context (`restaurant_id`).
2. Existing auth/session middleware remains authoritative for tenant isolation and authorization.
3. Existing `api/types.ts`, `api/client.ts`, `pages/*` and state layer remain single source for front-back contracts.
4. Existing premium feature pages are already partially implemented and should be hardened instead of rewritten:
   - `pages/app/website/+Page.tsx`
   - `pages/app/reservas/tables/+Page.tsx`

## 3) Security and config baseline

1. Do not commit any provider credential.
2. Cloudflare token handling:
   - Set as `CLOUDFLARE_API_TOKEN` in backend secret config.
3. Uazapi token/secret:
   - Set as backend secret `UAZAPI_API_TOKEN`.
4. Secrets never appear in query params or logs.
5. All calls return correlation IDs (`request_id`) and standardized errors:
   - `{ code, message, request_id, details? }`.

## 4) Source-of-truth contract updates

### 4.1 `api/types.ts` (frontend contract file)

Add/update types for each epic:

- `WebsiteTemplate`
- `WebsiteDraftRequest`
- `WebsiteDraftResponse`
- `DomainSearchQuery`
- `DomainSearchResult`
- `DomainQuote`
- `DomainRegisterRequest`
- `DomainRegisterResponse`
- `TableNode`
- `TableEdge`
- `TableArea`
- `TableStatusUpdateEvent`
- `Member`
- `RestaurantIntegrations` (ensure WhatsApp fields included)
- `WhatsAppMessageTemplate`
- `WhatsAppSendRequest`
- `WhatsAppSendResponse`

### 4.2 `api/client.ts` endpoint surface

Add typed endpoints:

- Website
  - `GET /api/premium/website`
  - `POST /api/premium/website`
  - `POST /api/premium/website/ai-draft`

- Domains
  - `POST /api/premium/domains/search`
  - `POST /api/premium/domains/quote`
  - `POST /api/premium/domains/register`
  - `POST /api/premium/domains/verify`

- Tables
  - `GET /api/premium/tables`
  - `PATCH /api/premium/tables/:id`
  - `PATCH /api/premium/tables/bulk`
  - `GET /api/premium/tables/ws` (tokenized websocket URL)

- Members + WhatsApp
  - `GET /api/premium/members`
  - `PATCH /api/premium/members/:id`
  - `GET /api/premium/whatsapp/templates`
  - `POST /api/premium/whatsapp/send`
  - `POST /api/premium/whatsapp/webhook`

## 5) Epic 1 — AI Website Builder & Templates

### Backend (service)

1. Create/verify DB tables:
   - `premium_website_profiles` with JSON fields for content, template selection, and publish state.
2. Add/adjust API endpoints:
   - `GET /api/premium/website`: return profile, templates metadata, and draft status.
   - `POST /api/premium/website`: upsert template selection / custom html / published state.
   - `POST /api/premium/website/ai-draft`: validate prompt + tenant context, call LLM provider, persist draft snapshot.
3. AI generation requirements:
   - Sanitize prompt output before storage.
   - Return strict schema:
     - `html_content`
     - `render_css` (if generated)
     - `meta` (title, lang, theme)
4. Billing event:
   - If any AI generation has per-tenant quota/costs, emit recurring invoice note/charge as agreed with finance policy.
5. Add endpoint tests:
   - Unauthorized tenant access rejected.
   - AI provider error surfaces as retryable/non-retryable code.

### Frontend (`backofficereact`)

1. Refine `pages/app/website/+Page.tsx`:
   - Split states: `template`, `draft`, `loading`, `error`, `preview`.
   - Add hard validation for prompt length and forbidden tokens.
2. Template gallery:
   - Load from backend template list, no hardcoded arrays.
   - Show thumbnail, name, and tags.
3. AI mode:
   - Prompt input with submit queue and disable on request in-flight.
   - Display generated preview in sandboxed iframe.
4. Publish flow:
   - Save template/draft and mark published state with confirmation modal.
5. Error handling:
   - Show inline validation and toast-style persistent summary for generation failures.

Acceptance criteria:
- A user can select template and publish a complete website payload.
- AI draft generation returns preview within timeout policy.
- Any unsafe HTML is blocked or sanitized.

## 6) Epic 2 — Cloudflare domain integration with 1.5x markup

### Backend

1. Domain service with Cloudflare API integration:
   - `search`: returns availability and base price.
   - `quote`: calculate `ceil(base_price * 1.5, 2)` (currency preserved).
   - `register`: idempotent request using `idempotency_key`.
2. DB/state:
   - store external domain provider IDs and DNS state fields:
     - `cf_domain_id`, `cf_zone_id`, `domain_status`.
   - status flow: `checking`, `pending`, `active`, `failed`.
3. Billing:
   - On successful registration create/extend recurring record in `recurring_invoices` for `markup_price`.
4. Webhook:
   - Add async reconciliation endpoint for registration verification and finalization.
5. Error contracts:
   - explicit provider errors mapped to `{UNAVAILABLE, INVALID_NAME, BILLING_BLOCKED, LIMIT_REACHED}`.

### Frontend

1. Extend `pages/app/website/+Page.tsx` with domain panel:
   - Search domain and show availability + price.
   - Quote section explicitly shows:
     - provider price
     - 1.5x markup
     - annual charge
2. Confirmation flow:
   - Confirm modal includes one-time cost summary and billing effect.
   - On success, poll domain status every 5s until `active` (max N attempts).
3. Failure UX:
   - Clear copy for blocked domain, invalid name, and provider downtime.

Acceptance criteria:
- “if provider=$10.00” displays “charged=$15.00”.
- registration flow is idempotent and safe against duplicate button clicks.
- domain verification updates UI status and enables website publish domain attachment only when active.

## 7) Epic 3 — Table manager (React Flow + live updates)

### Backend

1. Data model:
   - `restaurant_areas` with tenant id.
   - `premium_tables` with coordinates, capacity, status, rotation, shape metadata.
2. Endpoints:
   - `GET /api/premium/tables` returns full map state.
   - `PATCH /api/premium/tables/:id` updates geometry, capacity, status.
3. WS:
   - `GET /api/premium/tables/ws` publishes:
     - `table_status_changed`
     - `table_position_rebased`
     - `table_deleted` / `table_created`
   - Include event sequence and timestamp.
4. Concurrency:
   - reject stale client updates using version numbers or last_updated timestamps.

### Frontend

1. Finalize `pages/app/reservas/tables/+Page.tsx`:
   - Normalize API models to React Flow nodes/edges once and memoize.
   - Stable callback handlers for drag/reposition, save, status color palette.
2. Real-time:
   - connect to websocket, apply inbound events with local optimistic update reconciliation.
3. UX:
   - area filtering and quick legend (free/occupied/reserved).
   - local validation for overlaps outside bounds before save.
4. Resilience:
   - auto-reconnect with exponential backoff.
   - visual banner on offline state.

Acceptance criteria:
- Table move persists after drag (confirmed by reload).
- Live status changes from backend appear without refresh.
- Simultaneous edits are handled with controlled conflict resolution.

## 8) Epic 4 — Staff management + WhatsApp (Uazapi)

### Backend

1. Ensure member model has `whatsapp_number`.
2. Ensure restaurant integration settings include:
   - `uazapi_url`
   - `uazapi_token_ref` / masked credentials pointer
   - `default_sender_number` (optional)
3. Implement Uazapi send path:
   - validate premium entitlement
   - template/variable validation
   - enqueue and persist outgoing message with correlation id
4. Webhook handler:
   - verify signature / shared secret
   - update message status (`sent`, `delivered`, `read`, `failed`)
5. Add audit entries:
   - actor id, recipient id/phone, template, payload hash, status transitions.

### Frontend

1. Update member page(s):
   - show/edit `whatsapp_number`
   - add action “Send message” with per-member dialog.
2. Template picker:
   - load templates and preview merge fields.
3. Premium gating:
   - if feature inactive show upgrade path and disable send.
4. Delivery panel:
   - message timeline and latest status for each send action.

Acceptance criteria:
- send action triggers backend request and returns message id.
- inbound webhook updates are reflected in UI.
- non-premium tenants cannot trigger sends.

## 9) Contract + integration validation matrix

1. Backend-contract checks (required before frontend merge):
   - all new types compile in `api/types.ts`
   - frontend client methods cover all new routes
2. API smoke checks:
   - website CRUD + AI draft
   - domain quote/register/verify
   - table read/update/ws
   - whatsapp send + webhook
3. UX checks:
   - loading/error/retry states on every async endpoint
   - inline validation for invalid inputs
   - keyboard focus and aria labels for newly added controls

## 10) Delivery timeline (example)

1. Week 1:
   - finalize contracts and domain/websocket payloads
   - implement backend table schemas + website + domain basic endpoints
2. Week 2:
   - complete backend for WhatsApp + domain reconciliation
   - integrate frontend for website and domains
3. Week 3:
   - complete tables ws support and frontend mapping
4. Week 4:
4. hardening:
   - entitlement checks, retries, rollback for failed registrations, webhook replay handling
5. Week 5:
   - QA, staged deploy, monitoring dashboards, production release notes

## 11) Risks and mitigation

1. External API volatility (Cloudflare/Uazapi changes)
   - Add provider abstraction and contract tests against mocked responses.
2. WS state drift during reconnect
   - full snapshot refresh after reconnect + event replay checkpoint.
3. Markdown plan/feature drift between docs and implementation
   - require PR checklist: code, API contract, and docs update in same PR.

## 12) Final artifacts produced

1. `backofficereact/api/types.ts` and `backofficereact/api/client.ts` updated contracts.
2. Implemented routes in `pages/app/website/+Page.tsx` and `pages/app/reservas/tables/+Page.tsx`.
3. Backend endpoints/services for all four epics in API service.
4. Database migrations and recurring invoice updates for domain billing.
5. This plan doc updated to match code reality and acceptance criteria.
