# Backoffice Multitenant (React + Vike SSR) - Arquitectura y Plan

## Objetivo
- Backoffice SSR reutilizable (marca blanca) para múltiples restaurantes usando la misma base de datos MySQL.
- Villacarmen es el primer tenant, pero el diseño debe escalar a N restaurantes sin fugas de datos.

## Tenancy (backend Go)
- Resolución de tenant por `Host`:
  - Tabla `restaurant_domains(domain -> restaurant_id)`.
  - Middleware `withRestaurant` inyecta `restaurant_id` en `context` para todos los endpoints públicos/legacy.
- Backoffice: el tenant se define por sesión:
  - El usuario tiene acceso a varios restaurantes.
  - `bo_sessions.active_restaurant_id` determina el scope de los endpoints `/api/admin/*`.

## Autenticación (backoffice)
- Cookie de sesión `HttpOnly + Secure + SameSite=Lax` emitida por Go (`/api/admin/login`).
- El servidor SSR (`backoffice/server/index.ts`) hace proxy de `/api/*` a Go para mantener 1 solo origin y permitir cookies `Secure`.
- SSR guard:
  - Rutas `/app/*` requieren sesión (si no, redirect a `/login`).
  - `/login` redirige a `/app/dashboard` si ya hay sesión.

## Estado Frontend
- Solo Jotai atoms (sin Context Providers/Redux).
- En SSR: store por request (`createStore()` + `useHydrateAtoms`) para evitar fugas entre requests.
- Tema light/dark con cookie `bo_theme` (Secure) + `data-theme` en `documentElement`.

## UI / DX
- CSS base y tokens: `backoffice/components/bo.css` (no `globals.css`).
- Componentes propios:
  - Select: `backoffice/ui/inputs/Select.tsx`
  - DatePicker: `backoffice/ui/inputs/DatePicker.tsx`
  - Dropdown: `backoffice/ui/inputs/DropdownMenu.tsx`
  - Modal/Confirm/Alerts/Toasts: `backoffice/ui/*`
- Transiciones suaves entre rutas con `motion/react` (fade in/out) en `backoffice/pages/app/+Layout.tsx`.
- Iconos: `lucide-react`.

## API Client
- Cliente único por módulos: `backoffice/api/client.ts`.
- Tipos en `backoffice/api/types.ts`.

## Esquema MySQL (multitenant + white-label)
- `restaurants`: registro de restaurantes.
- `restaurant_domains`: mapping dominio -> restaurante.
- `restaurant_branding`: marca (nombre/logo/colores/from email).
- `restaurant_integrations`: integraciones (n8n webhook, allowlist de eventos, UAZAPI, números WhatsApp del restaurante).
- `message_deliveries`: log de entregas (usado ya para webhooks n8n).

## Pantallas Backoffice (mínimo viable)
- Dashboard: métricas por fecha.
- Reservas: listado/cancelación.
- Menús: edición menú día/finde, postres, vinos, menús de grupos, visibilidad web.
- Config: apertura/cierre, límite diario, horarios, mesas de 2, salón condesa.
- Ajustes: branding + integraciones (n8n/UAZAPI + receptores WhatsApp).

## Automatizaciones (n8n / WhatsApp)
- Eventos emitidos desde Go:
  - `booking.created`, `booking.confirmed`, `booking.cancelled` hacia `restaurant_integrations.n8n_webhook_url`.
  - Allowlist por `enabled_events_json` (vacío => todos habilitados).
- WhatsApp:
  - Credenciales por restaurante: `restaurant_integrations.uazapi_url/uazapi_token`.
  - Receptores del restaurante: `restaurant_whatsapp_numbers_json` (elimina hardcodes).

## Siguientes pasos recomendados
1. UI de “Gestión de restaurantes” (solo superadmin):
   - CRUD de `restaurants`.
   - CRUD de `restaurant_domains`.
2. Historial de entregas:
   - Endpoint + pantalla para `message_deliveries` (webhooks y WhatsApp/email si se añaden).
3. Email real:
   - Definir provider (SMTP/API) + plantilla multi-tenant usando `restaurant_branding`.
4. White-label en páginas HTML legacy:
   - Reemplazar strings/branding hardcoded restantes por `restaurant_branding`.

