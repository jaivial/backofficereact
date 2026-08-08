# E2E Edge — Pantalla 5: Shell de la app

Sección `/app` (home backoffice), sidebar, topbar, switcher de restaurante, Forky.

## Interacciones reales de usuario
- Login → redirige a `/app/backoffice` (home).
- `/app` y `/app/backoffice` muestran el home con accesos rápidos (orbit + lista).
- Navegar entre secciones desde el sidebar (11 secciones para role root).
- Logo sidebar → volver al home.
- Switcher de restaurante (topbar) → cambia restaurante activo y recarga.
- Menú de usuario → "Salir" (logout) → vuelve a `/login`.
- Toggle Forky (topbar) y botón flotante Forky → abrir/cerrar asistente.
- Sesión expirada en plena navegación → redirige a `/login`.

## Edge cases
1. Deep-link directo a `/app/backoffice` con sesión → home renderiza (no crash).
2. Navegación sidebar: item activo refleja ruta actual (`is-active`).
3. Logout limpia sesión: `/api/admin/me` responde 401 tras salir.
4. Cambio de restaurante activo persiste tras recarga (session re-fetch).
5. Forky: abrir y cerrar modal repetidamente sin estado colgado.
6. Restaurante sin switcher cuando solo hay 1 restaurante (no aplica: admin tiene 4).
