# E2E Edge — Pantalla 9: Comida (Carta)

Rutas: `/app/comida` (hub), `/app/comida/{tipo}`, `/app/comida/{tipo}/{foodId}`.

## Interacciones reales de usuario
- Hub: elegir categoría (Platos, Bebidas, Cafes, Vinos).
- Lista de ítems con filtros, paginación, toggle "Mostrar imagenes".
- Alta rápida (FAB), editar/activar/eliminar ítem.
- Detalle de ítem (`@foodId`).

## Edge cases
1. Tipo inválido en URL (`/app/comida/zz`) → muestra "Tipo de comida invalido" sin 500.
   - Nota: tras el error, la página también renderiza la lista de Platos por defecto (quirk UX observado).
2. Paginación en lista grande (platos 108 ítems) → Siguiente/Anterior.
3. Categoría sin ítems → estado vacío (`food-list-empty`).
