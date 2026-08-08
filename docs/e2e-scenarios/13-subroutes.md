# E2E Edge — Sub-rutas restantes

## Comida detalle (`/app/comida/{tipo}/{foodId}`)
- Abrir detalle desde la tarjeta "Editar" → navega a `/app/comida/{tipo}/{id}` y renderiza.
- Edge: id inexistente → "Elemento no disponible" sin 500.

## Facturas recurrentes (`/app/facturas/recurrentes`)
- Página con stats y botón "Nueva Facturación Recurrente".
- Edge: sin recurrencias → alert de estado vacío (sin crash).

## Mi horario (`/app/miembros/mi-horario`)
- Vista de horario propio.
- Edge: sin sesión activa de miembro → "No hay sesión activa" (sin crash).

## Mapa de mesas (`/app/reservas/tables`)
- Mapa con nodos de mesa y controles.
- Edge: renderiza nodos y botón añadir mesa.
