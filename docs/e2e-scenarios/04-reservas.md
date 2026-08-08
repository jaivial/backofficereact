# E2E Edge — Pantalla 7: Reservas

Rutas: `/app/reservas?date=`, `/app/reservas/anadir`, `/app/reservas/config`, `/app/reservas/tables`.
Tabs externos: Reservas / Mapas / Configuración / Añadir. Tabs de estado: Activas / Canceladas / Modificadas.

## Interacciones reales de usuario
- Listar reservas del día (fecha vía query).
- Cambiar estado de reservas (Activas/Canceladas/Modificadas).
- Buscar por nombre del cliente.
- Abrir detalle de una reserva (click en mesa/card) → panel con Editar/Cerrar.
- Paginar cuando hay muchas.
- Navegar a Añadir / Configuración / Mapas por tabs.
- Config diaria: límite de comensales (+/-), horarios.

## Edge cases
1. Fecha sin reservas → sección vacía sin crash (estado vacío).
2. `date` inválida → sin 500.
3. Apertura y cierre de detalle repetida → sin estado colgado.
4. Config: incrementar y decrementar límite diario → persiste (y restaurar).
5. Tab de estado con 0 resultados → lista vacía con controles visibles.
