# Premium Features Implementation Plan

This document serves as a comprehensive prompt and execution guide for an AI agent to implement a suite of new Premium Features for the New Villa Carmen Multitenant SaaS. 

**Agent Instructions**: 
Read this document carefully. You will be implementing complex features involving the Go backend (`backend/`), the React/Vike frontend (`backoffice/`), and custom database schemas. Do not use ORMs; stick to Go's `database/sql` and raw SQL migrations as per the project's existing architecture. Create your implementation plan using a Todo list before starting.

---

## 🎯 Architecture & Core Directives

1. **Frontend (`backoffice/`)**: React 19 + Vike (SSR). Use TailwindCSS, Radix UI, Jotai for state, and React Flow for the table manager.
2. **Backend (`backend/`)**: Go (`net/http`) + MySQL. All new tables must include `restaurant_id` for multitenancy.
3. **WebSockets**: Use `gorilla/websocket` in Go. Model your implementation after the existing `/api/admin/fichaje/ws` implementation.
4. **Billing**: The project uses a custom `recurring_invoices` table (see `BACKEND_RECURRING_BILLING.md`). Premium features must generate invoices here instead of direct Stripe calls.

---

## 🚀 Epic 1: AI Website Builder & Templates (Premium)

**Goal**: Allow restaurants to generate a public website from their backoffice data (menu, hours, contact) either by selecting from 10 premium templates or using an AI HTML builder.

### Backend Tasks:
1. **Migration**: Create `restaurant_websites` table (`id`, `restaurant_id`, `template_id`, `custom_html`, `domain`, `is_published`, `created_at`, `updated_at`).
2. **Endpoints**:
   - `GET /api/admin/website`: Fetch current website config.
   - `PUT /api/admin/website`: Save template selection or custom HTML.
   - `POST /api/admin/website/ai-generate`: Accept prompt and restaurant context (fetch menus/hours), call an LLM API (OpenAI/Anthropic), and return a complete styled HTML string.

### Frontend Tasks:
1. **Route**: Create `/pages/admin/website-builder/+Page.tsx`.
2. **UI Components**:
   - **Template Selector**: A gallery of 10 hardcoded template designs (thumbnail + name). When selected, it connects to the restaurant's DB to display their menu to the world.
   - **AI Builder Mode**: A chat/prompt interface where the user describes their desired website. Display the generated `custom_html` inside an isolated `<iframe>` or `dangerouslySetInnerHTML` for preview.
   - **Publish Button**: Saves the active template/HTML to the backend.

---

## 🚀 Epic 2: Domain Registration via Cloudflare

**Goal**: Allow users to search and buy custom domains directly from the backoffice. The app registers the domain via Cloudflare API but charges the user 1.5x the Cloudflare cost (profit margin).

### Backend Tasks:
1. **Integration**: Implement Cloudflare Registrar API client in `backend/internal/api/cloudflare.go`.
2. **Endpoints**:
   - `GET /api/admin/domains/search?query=...`: Call Cloudflare API to check availability and base price. Multiply the returned price by **1.5x** before returning to the frontend.
   - `POST /api/admin/domains/register`: Accept domain name. 
     - *Step A*: Call Cloudflare API to register the domain.
     - *Step B*: Insert a new row into `recurring_invoices` for the marked-up price (yearly frequency) so the company bills the client.
     - *Step C*: Update `restaurant_websites.domain` with the new domain.

### Frontend Tasks:
1. **UI Components**: Inside the Website Builder, add a "Connect Custom Domain" section.
2. **Search Flow**: Search bar for domains. Display results with the 1.5x marked-up price (e.g., if Cloudflare charges $10, display $15).
3. **Checkout Flow**: A confirmation modal explaining the yearly cost. On confirm, hit the register endpoint.

---

## 🚀 Epic 3: Table Manager (React Flow & WebSockets)

**Goal**: A visual table map creator using `reactflow` where restaurants can draw their floor plans, add/move tables, and see live occupancy updates via WebSockets.

### Backend Tasks:
1. **Migrations**: 
   - `restaurant_areas` (`id`, `restaurant_id`, `name`, `bg_color`).
   - `restaurant_tables` (`id`, `restaurant_id`, `area_id`, `name`, `capacity`, `x_pos`, `y_pos`, `status` [available, occupied, reserved]).
2. **Endpoints**:
   - `GET /api/admin/tables`: Return areas and tables.
   - `POST/PUT /api/admin/tables`: Create/update tables (especially X/Y coordinates).
3. **WebSocket**: 
   - Implement `/api/admin/tables/ws` in `backend/internal/api/backoffice_tables_ws.go`.
   - Manage connection pools by `restaurant_id`.
   - Broadcast `{ type: "table_status_changed", table_id: 123, status: "occupied" }` when a table status updates.

### Frontend Tasks:
1. **Route**: Create `/pages/admin/tables/+Page.tsx`.
2. **React Flow Integration**:
   - Install `reactflow` if not present.
   - Map `restaurant_tables` to React Flow `nodes`.
   - Custom Node Component: A stylized table shape showing `name`, `capacity`, and changing color based on `status`.
   - Implement `onNodeDragStop` to send `PUT` requests updating `x_pos` and `y_pos`.
3. **Live Updates**: Connect to `/api/admin/tables/ws`. Update the Jotai store or React state when a broadcast is received to instantly change table colors without refreshing.

---

## 🚀 Epic 4: Staff/Member Management & Uazapi WhatsApp Integration

**Goal**: Expand the existing members section to allow full staff control and add a premium "WhatsApp Pack" using Uazapi (a business WhatsApp API provider) with a centralized company account.

### Backend Tasks:
1. **Migrations**: Add `whatsapp_number` to the existing `members` or `restaurant_members` table.
2. **Uazapi Integration**: Create `backend/internal/api/uazapi.go` for making outbound HTTP requests to the Uazapi/Evolution API endpoints using the central company token.
3. **Endpoints**:
   - `GET /api/admin/members`: Return the list of members (ensure `whatsapp_number` is included).
   - `PUT /api/admin/members/:id`: Update member details.
   - `POST /api/admin/members/whatsapp/send`: 
     - *Validation*: Check if the `restaurant_id` has an active Premium WhatsApp subscription (query `recurring_invoices` or a settings table).
     - *Action*: Call Uazapi to send the template/message to the member's WhatsApp number.

### Frontend Tasks:
1. **Route**: Update or create `/pages/admin/members/+Page.tsx` (List of members section).
2. **UI Enhancements**: 
   - Add columns for WhatsApp numbers and role/personal control.
   - Add a "Send WhatsApp Message" action button per row.
3. **Premium Paywall**: If the restaurant doesn't have the feature active, clicking the WhatsApp button should open a modal: *"Upgrade to the Premium WhatsApp Pack to notify your staff instantly"*, which triggers a subscription creation.

---

## 📋 Execution Protocol for the AI Agent

When you start implementing this plan:
1. **Use `todowrite`**: Break these 4 epics down into 15-20 atomic tasks. 
2. **Work Incrementally**: Do not write all the Go code at once. Implement Epic 1 backend, test compilation (`go build`), then Epic 1 frontend, verify with `lsp_diagnostics`, and so on.
3. **Ask for Clarification**: If the exact Cloudflare Registrar or Uazapi payload isn't known, ask the user for documentation links or sample cURL requests before blindly guessing the JSON structure.
4. **Follow Conventions**: Strictly use `httpx.WriteJSON` for responses and `database/sql` for queries as seen in existing `backend/internal/api/*.go` files.