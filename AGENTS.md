# Backoffice UI (vanilla) reglas de estilo

Scope: todo lo que cuelga de `backoffice/`.

## Objetivo
- Replicar el estilo del dashboard (tema oscuro, cards suaves, acentos lila/cian) usando solo HTML + CSS vanilla.
- Mantener el CSS ligero: sin frameworks, sin dependencias, sin JS para layout.
- Soporte completo para temas claro y oscuro con cumplimiento WCAG.

## Estructura
- Componentes y preview viven en `backoffice/components/`.
- CSS base/tokens: `backoffice/components/bo.css` (no duplicar tokens en otros CSS).
- Vista previa de todos los componentes: `backoffice/components/index.html`.

## Convenciones
- Prefijo de clases: `bo-` (evita colisiones).
- Componentes: 1 ficheo `.html` por componente; todos linkean `./bo.css`.
- Iconos: siempre inline SVG (stroke `currentColor`, `stroke-width: 1.8`, caps/joins redondeados).

## Tokens (no hardcodear)
- Colores, radios y sombras se consumen desde `:root` en `backoffice/components/bo.css`.
- Superficies: usar `--bo-surface*` con overlays `linear-gradient(...)` para profundidad.
- Acentos: `--bo-accent` (lila), `--bo-accent-2` (cian), `--bo-accent-3` (card clara).

## Layout y componentes
- Sidebar: 78px, botones 44x44 con `border-radius: 16px`, estado activo con fondo lila translúcido.
- Cards métricas: `--bo-radius-md`, borde sutil (`--bo-border`), `box-shadow: --bo-shadow-soft`.
- Panels: `--bo-radius-lg` y padding interno consistente (`16-18px`).
- Tablas: `border-collapse`, separadores muy finos, hover discreto.

## Tipografía y espaciado
- Fuente: stack del sistema (`--bo-font`), pesos 650-780 según jerarquía.
- Texto secundario: `--bo-muted` / `--bo-faint` (no bajar opacidad a ojo).
- Espaciado: usa la misma escala ya usada en `bo.css` (8/10/12/14/16/18/24).

## Temas (Dark/Light)
Todos los componentes deben soportar ambos temas:

### Variables de tema oscuro (default)
```css
:root {
  --bo-bg: #111218;
  --bo-shell: #1a1b22;
  --bo-surface: #22232b;
  --bo-surface-2: #2a2b34;
  --bo-text: #eef0f6;
  --bo-muted: rgba(238, 240, 246, 0.64);
  --bo-faint: rgba(238, 240, 246, 0.42);
}
```

### Variables de tema claro
```css
:root[data-theme="light"] {
  --bo-bg: #f4f6fb;
  --bo-shell: #ffffff;
  --bo-surface: #ffffff;
  --bo-surface-2: #fbfcff;
  --bo-text: rgba(20, 21, 26, 0.95);
  --bo-muted: rgba(20, 21, 26, 0.62);
  --bo-faint: rgba(20, 21, 26, 0.46);
}
```

## Accesibilidad y motion (WCAG 2.1 AA)

### Requisitos obligatorios
- `aria-label` en botones/icon-only.
- `role` apropiado para componentes (tablist, tab, menu, dialog, etc.).
- `aria-expanded` para estados de despliegue.
- `aria-selected` para tabs activa.
- `aria-hidden="true"` en iconos decorativos.
- `aria-current="page"` para breadcrumb activo.
- `role="alert"` y `aria-live` para notificaciones.
- `tabindex` correcto (-1 para no enfocable, 0 para enfocable).
- `focus-visible` para indicadores de teclado.
- Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande.
- Objetos táctiles mínimos 44x44px en móvil.

### Estados de focus
```css
:focus-visible {
  outline: 2px solid var(--bo-accent);
  outline-offset: 2px;
}
```

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

## Componentes disponibles

### Layout
- `dashboard.html` - Dashboard completo
- `sidebar.html` - Navegación lateral
- `topbar.html` - Barra superior

### Cards & Métricas
- `card-stat.html` - Tarjeta de estadísticas
- `card-obligation.html` - Tarjeta de obligaciones
- `card-metric.html` - Fila de KPIs
- `cards.html` - Tarjetas mejoradas (hover, seleccionable, con imagen)

### Datos & Tablas
- `table-customers.html` - Tabla de clientes
- `data-table.html` - Tabla mejorada (sorting, selección, paginación)
- `calendar.html` - Calendario completo
- `calendar-agenda.html` - Vista de agenda

### Formularios
- `form-inputs.html` - Inputs de formulario
- `form-checkboxes.html` - Checkboxes y radios
- `form-toggle.html` - Toggles/switches
- `button-variants.html` - Variantes de botones

### Navegación
- `tabs.html` - Tabs con indicador
- `breadcrumb.html` - Breadcrumbs
- `stepper.html` - Stepper/wizard
- `pagination.html` - Paginación

### Feedback & Overlay
- `modal.html` - Diálogos modales
- `toast.html` - Notificaciones toast
- `alert.html` - Alertas inline
- `tooltip.html` - Tooltips
- `progress.html` - Barras de progreso

### Estados & Loading
- `spinner.html` - Spinners y skeleton loading
- `empty-state.html` - Estados vacíos
- `search.html` - Búsqueda con sugerencias

### UI Elements
- `badges.html` - Badges y chips
- `avatar.html` - Avatares con estados
- `dropdown.html` - Menús desplegables
- `list.html` - Listas
- `accordion.html` - Acordeón
- `divider.html` - Divisores
- `chart-activity.html` - Gráfico de actividad
- `card-monthly-billing.html` - Facturación mensual

## Componentes reutilizables (React)
- Navegación:
  - `ui/nav/Tabs.tsx` (tabs de ruta)
  - `ui/nav/NavLink.tsx` (items sidebar)
- Calendario / fechas:
  - `ui/widgets/MonthCalendar.tsx`
  - `ui/inputs/DatePicker.tsx`
- Métricas / tarjetas:
  - `ui/widgets/StatCard.tsx`
- Modales / overlays:
  - `ui/overlays/Modal.tsx`
  - `ui/overlays/ConfirmDialog.tsx`
- Feedback:
  - `ui/feedback/ToastStack.tsx`
  - `ui/feedback/InlineAlert.tsx`
- Miembros / turnos:
  - `ui/widgets/MemberPicker.tsx`
  - `ui/widgets/TimeAdjust.tsx`
  - `ui/widgets/TimeAdjustCounter.tsx`
  - `ui/widgets/TimeEntriesEditor.tsx`
  - `ui/widgets/MemberShiftModal.tsx`

## Regla de extracción
- Si un patrón visual/funcional aparece en 2 o más páginas, extraerlo a `ui/widgets/`.
- No duplicar tokens visuales fuera de `components/bo.css`.

## Colores de estado (para badges, alerts, etc.)
- `--bo-accent` / Lila: #b9a8ff (primario)
- `--bo-accent-2` / Cyan: #93efe7 (secundario)
- Success / Verde: #28a745
- Warning / Amarillo: #ffc107
- Danger / Rojo: #dc3545
- Info / Azul: #0dcaf0

## Guía de uso de componentes

### Crear nuevo componente
1. Crear `nombre-componente.html` en `components/`
2. Usar estructura base:
```html
<div class="bo-stage">
  <div class="bo-window">
    <div class="bo-app">
      <!-- Contenido del componente -->
    </div>
  </div>
</div>
```
3. Agregar link en `index.html`

### Agregar nuevo componente React
1. Crear en `ui/widgets/` o `ui/inputs/` según tipo
2. Usar mismas clases CSS (`bo-` prefix)
3. Soportar prop `theme?: 'light' | 'dark' | 'system'`
4. Testear en ambos temas
