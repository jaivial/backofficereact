# Backoffice UI (vanilla) reglas de estilo

Scope: todo lo que cuelga de `backofficereact/`.

## Objetivo
- Replicar el estilo del dashboard (tema oscuro, cards suaves, acentos lila/cian) usando solo HTML + CSS vanilla.
- Mantener el CSS ligero: sin frameworks, sin dependencias, sin JS para layout.
- Soporte completo para temas claro y oscuro con cumplimiento WCAG.

## Skills a usar en este scope
- `villacarmen-backoffice-ssr`:
  usar por defecto para cualquier `read/edit/update` en `backoffice/` (SSR vike, cliente API admin, UI compartida).
- `villacarmen-contract-sync`:
  usar además cuando el cambio dependa de nuevos contratos backend o modifique consumo de `/api/admin/*`.
- `villacarmen-smoke-check`:
  usar al cerrar tareas para validacion rapida de typecheck/build e integracion.

## Estructura
- Componentes y preview viven en `backofficereact/components/`.
- CSS base/tokens (FUENTE UNICA DE VERDAD): `backofficereact/components/bo.css` (no duplicar tokens en otros CSS).
- `backofficereact/public/bo.css` no define la guia visual: no usarlo como referencia de estilos y no editarlo manualmente para cambios de diseño.
- Vista previa de todos los componentes: `backofficereact/components/index.html`.

## Convenciones
- Prefijo de clases: `bo-` (evita colisiones).
- Componentes: 1 ficheo `.html` por componente; todos linkean `./bo.css`.
- Iconos: siempre inline SVG (stroke `currentColor`, `stroke-width: 1.8`, caps/joins redondeados).
- **NUNCA hardcodear colores, spacing, border-radius o transiciones** - usar siempre tokens CSS.
- **NUNCA usar `transition: all`** - especificar propiedades.
- **SIEMPRE tomar tokens y estilos base desde `backofficereact/components/bo.css`**.

## Tokens (no hardcodear)
- Colores, radios y sombras se consumen desde `:root` en `backofficereact/components/bo.css`.
- Superficies: usar `--bo-surface*` con overlays `linear-gradient(...)` para profundidad.
- Acentos: `--bo-accent` (lila), `--bo-accent-2` (cian), `--bo-accent-3` (card clara).

### Tokens de tipografía
```css
:root {
  /* Font sizes - escala base 4px */
  --bo-text-xs: 10px;    /* etiquetas pequeñas, metadata */
  --bo-text-sm: 12px;    /* secundario, etiquetas */
  --bo-text-base: 14px;  /* cuerpo de texto */
  --bo-text-lg: 16px;    /* subtítulos */
  --bo-text-xl: 20px;    /* títulos de página */
  --bo-text-2xl: 24px;   /* encabezados de sección */
  --bo-text-3xl: 32px;   /* números destacados */

  /* Font weights - solo 4 opciones */
  --bo-weight-normal: 400;
  --bo-weight-medium: 500;
  --bo-weight-semibold: 600;
  --bo-weight-bold: 700;

  /* Line heights */
  --bo-leading-tight: 1.25;
  --bo-leading-normal: 1.4;
  --bo-leading-relaxed: 1.6;
}
```

### Tokens de spacing
```css
:root {
  /* Spacing scale */
  --bo-space-1: 4px;
  --bo-space-2: 8px;
  --bo-space-3: 12px;
  --bo-space-4: 16px;
  --bo-space-5: 24px;
  --bo-space-6: 32px;
  --bo-space-8: 48px;
}
```

### Tokens de border radius
```css
:root {
  --bo-radius-sm: 8px;    /* botones, inputs */
  --bo-radius-md: 12px;   /* cards */
  --bo-radius-lg: 16px;   /* panels, modals */
  --bo-radius-full: 9999px; /* pills, avatares circulares */
}
```

### Tokens de transiciones
```css
:root {
  /* Duraciones estandarizadas - usar solo estas */
  --bo-transition-fast: 120ms;
  --bo-transition-base: 150ms;
  --bo-transition-slow: 300ms;

  /* Easing */
  --bo-ease: ease;
  --bo-ease-out: ease-out;
  --bo-ease-in-out: ease-in-out;
}
```

## Layout y componentes
- Sidebar: 78px, botones 44x44 con `border-radius: var(--bo-radius-md)`, estado activo con fondo lila translúcido.
- Cards métricas: `border-radius: var(--bo-radius-md)`, borde sutil (`--bo-border`), `box-shadow: var(--bo-shadow-soft)`.
- Panels: `border-radius: var(--bo-radius-lg)` y padding interno consistente (`16-18px`).
- Tablas: `border-collapse`, separadores muy finos, hover discreto.
- **Botones**: altura 40px, `border-radius: var(--bo-radius-sm)`, padding horizontal 14px.
- **Inputs**: altura 40px, `border-radius: var(--bo-radius-sm)`.
- **Action buttons**: 36x36px, `border-radius: var(--bo-radius-md)`.
- Regla de oro rendimiento React: cualquier lista/mapa/bloque derivado (arrays, objetos con `label/estado`, contadores o filtros) que dependa de `state/props` y se pase al árbol visual debe memoizarse con `useMemo`; los callbacks de UI que suben al árbol deben ser `useCallback` para estabilizar renders.

## Tipografía y espaciado
- Fuente: stack del sistema (`--bo-font`).
- **Usar tokens de tipografía**: `--bo-text-xs`, `--bo-text-sm`, `--bo-text-base`, etc.
- **Pesos simplificados**: usar solo `--bo-weight-normal` (400), `--bo-weight-medium` (500), `--bo-weight-semibold` (600), `--bo-weight-bold` (700).
- **Line heights**: usar `--bo-leading-tight` (1.25), `--bo-leading-normal` (1.4), `--bo-leading-relaxed` (1.6).
- Texto secundario: `--bo-muted` / `--bo-faint` (no hardcodear opacidad).
- Espaciado: usar tokens `--bo-space-*` (4/8/12/16/24/32/48px).

## Temas (Dark/Light)
Todos los componentes deben soportar ambos temas:

### Variables de tema oscuro (default)
```css
:root {
  --bo-bg: #111218;
  --bo-shell: #1a1b22;
  --bo-surface: #22232b;
  --bo-surface-2: #2a2b34;
  --bo-surface-3: #16171d;
  --bo-sidebar: #14151b;
  --bo-border: rgba(255, 255, 255, 0.06);
  --bo-border-2: rgba(255, 255, 255, 0.09);
  --bo-text: #eef0f6;
  --bo-muted: rgba(238, 240, 246, 0.64);
  --bo-faint: rgba(238, 240, 246, 0.52); /* WCAG AA: 4.5:1 mínimo */
  --bo-accent: #b9a8ff;
  --bo-accent-2: #93efe7;
  --bo-accent-3: #cfeff0;
}
```

### Variables de tema claro
```css
:root[data-theme="light"] {
  --bo-bg: #f4f6fb;
  --bo-shell: #ffffff;
  --bo-surface: #ffffff;
  --bo-surface-2: #fbfcff;
  --bo-surface-3: #f2f4fb;
  --bo-sidebar: #ffffff;
  --bo-border: rgba(0, 0, 0, 0.08);
  --bo-border-2: rgba(0, 0, 0, 0.12);
  --bo-text: rgba(20, 21, 26, 0.95);
  --bo-muted: rgba(20, 21, 26, 0.62);
  --bo-faint: rgba(20, 21, 26, 0.46);
  /* IMPORTANTE: overrides de acentos para mejor contraste en light */
  --bo-accent: #7c5ce7;      /* más oscuro que #b9a8ff para light */
  --bo-accent-2: #0d9488;    /* más oscuro que #93efe7 para light */
  --bo-accent-3: #5eead4;
}
```

### Variables de estado (definir en :root)
```css
:root {
  --bo-color-success: #16a34a;
  --bo-color-warning: #d97706;
  --bo-color-danger: #dc2626;
  --bo-color-info: #0284c7;
  --bo-text-success: #16a34a;
  --bo-text-warning: #d97706;
  --bo-text-danger: #dc2626;
  --bo-border-color: var(--bo-border);
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

### Estados de focus (OBLIGATORIOS en todos los elementos interactivos)
```css
:focus-visible {
  outline: 2px solid var(--bo-accent);
  outline-offset: 2px;
}

/* Todos los elementos interactivos deben tener focus visible */
button:focus-visible,
[role="button"]:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
.bo-checkboxContainer:focus-visible,
.bo-radioGroup:focus-visible {
  outline: 2px solid var(--bo-accent);
  outline-offset: 2px;
}

/* Tema claro: outline más visible */
:root[data-theme="light"] :focus-visible {
  outline-color: rgba(124, 92, 231, 0.9); /* --bo-accent más oscuro */
}
```

### Estados de hover (REQUERIDOS en elementos interactivos)
- Todo elemento con `:hover` debe tener también `:focus-visible`
- Usar transiciones de `--bo-transition-base` (150ms)
- **NUNCA usar `transition: all`** - especificar propiedades explícitamente

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

### Reglas de formularios
- Inputs y selects: misma altura (40px) y border-radius (var(--bo-radius-sm))
- Labels: siempre asociados con `for`/`id`
- Error states: border color + background tint + mensaje de error
- Disabled: `opacity: 0.62`, `cursor: not-allowed`
- Focus states: obligatorio en checkboxes y radios (no depender solo del global)

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
- Regla estricta: antes de crear UI nueva, revisar `backofficereact/ui/` y reutilizar componentes existentes.
- Si existe componente equivalente en `ui/`, es obligatorio usarlo o extenderlo con props/variantes; no duplicar markup/estilos.
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
- Si el patrón ya existe en `ui/`, reutilizarlo primero; extraer solo cuando no exista una opción reusable.
- No duplicar tokens visuales fuera de `components/bo.css`.

## Colores de estado (para badges, alerts, etc.)
**IMPORTANTE**: Usar siempre variables CSS, no hardcodear colores.

- `--bo-accent` / Lila: #b9a8ff (primario)
- `--bo-accent-2` / Cyan: #93efe7 (secundario)
- `--bo-color-success` / Verde: #16a34a
- `--bo-color-warning` / Amarillo: #d97706
- `--bo-color-danger` / Rojo: #dc2626
- `--bo-color-info` / Azul: #0284c7

### Colores en light theme
Los colores de estado deben mantener contraste WCAG AA en ambos temas:
- Usar `--bo-color-*` para backgrounds/borders
- Usar `--bo-text-*` para texto sobre fondos claros
- En light theme: considerar versiones más oscuras de los colores

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
1. Revisar `backofficereact/ui/` para confirmar si ya existe un componente reusable equivalente.
2. Si existe, reutilizarlo/extenderlo (no crear duplicado).
3. Si no existe, crear en `ui/widgets/` o `ui/inputs/` según tipo.
4. Usar mismas clases CSS (`bo-` prefix).
5. Soportar prop `theme?: 'light' | 'dark' | 'system'`.
6. Testear en ambos temas.
7. **Usar `cn()` utility** para combinar clases (no string concatenation):
   ```tsx
   import { cn } from "../shadcn/utils";

   // BIEN
   className={cn("bo-btn", variant && `bo-btn--${variant}`, className)}

   // MAL
   className={"bo-btn " + (variant ? "bo-btn--" + variant : "") + " " + className}
   ```
