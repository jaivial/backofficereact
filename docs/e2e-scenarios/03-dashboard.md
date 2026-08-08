# E2E Edge — Pantalla 6: Dashboard

Ruta: `/app/dashboard?date=YYYY-MM-DD`. SSR: fetch `api.dashboard.getMetrics(date)`.

## Interacciones reales de usuario
- Abrir `/app/dashboard` → KPIs de reservas + KPIs de facturas.
- Cambiar la fecha vía query param (histórica / futura) → métricas de ese día.
- Si métricas son nulas (error) → la página no renderiza KPIs (espacio vacío) y muestra toast de error.

## Edge cases
1. Sin `date` → default hoy → KPIs visibles.
2. `date=abc` (inválida) → sin 500; página en blanco (metrics null). Comportamiento observado: no hay fallback visual.
3. `date` histórica válida → renderiza KPIs.
4. `date` futura válida → renderiza KPIs (probablemente a 0).
5. Error del backend → página en blanco sin crash (solo toast).
