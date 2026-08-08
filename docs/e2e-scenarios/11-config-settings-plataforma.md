# E2E Edge — Pantallas 19-21: Config, Settings, Plataforma/Comsit

## Config (`/app/config`, `/app/config/booking`, `/app/config/legal-pages`)
- Tabs: Restaurante / Contacto / Booking / Legal pages / IA.
- Booking manager con guía de instalación y preview del widget.
- Edge: navegar tabs; booking renderiza guía + preview.

## Settings (`/app/settings`)
- Panels: Integraciones, Fiscal, Branding, Website, Facturación.
- Edge: campos de branding presentes; guardar sin cambios no rompe.

## Plataforma (`/app/plataforma`)
- Tabs: Dashboard / Restaurantes / Usuarios / Suscripciones / WhatsApp / Stripe / Dominios / Servidores.
- Edge: navegar entre tabs; dashboard con métricas.

## Comsit (`/app/comsit`)
- Alias de configuración de reservas (misma UI que /app/config).
- Edge: carga sin error.
