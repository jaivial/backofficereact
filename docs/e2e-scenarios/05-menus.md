# E2E Edge — Pantalla 8: Menus

Ruta: `/app/menus`. Paneles de tipo de menú → tarjetas → editor (`/app/menus/crear`).

## Interacciones reales de usuario
- Ver paneles de tipo de menú con contadores.
- Elegir un tipo → lista de tarjetas de menú (con estado/borrador/precio).
- Volver a los tipos ("Volver a tipos de menu").
- Buscar por título (filtros).
- Limpiar filtros.
- Botón flotante "Crear menu" → modal con plantillas de tipo.

## Edge cases
1. Panel con 0 menús → tarjeta/panel presente, listado vacío al entrar.
2. Buscar texto inexistente → lista vacía sin crash.
3. Abrir modal de crear y cerrar (Escape/cerrar) → vuelve a la lista.
4. Navegar a tarjeta y volver → el estado de filtros se conserva.

## Notas
- Typo UI observado: botón "Limipiar filtros" → debe ser "Limpiar filtros" (corregido en code fix).
