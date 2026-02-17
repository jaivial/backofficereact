# Backoffice UI (vanilla) reglas de estilo

Scope: todo lo que cuelga de `backoffice/`.

## Objetivo
- Replicar el estilo del dashboard (tema oscuro, cards suaves, acentos lila/cian) usando solo HTML + CSS vanilla.
- Mantener el CSS ligero: sin frameworks, sin dependencias, sin JS para layout.

## Estructura
- Componentes y preview viven en `backoffice/components/`.
- CSS base/tokens: `backoffice/components/bo.css` (no duplicar tokens en otros CSS).

## Convenciones
- Prefijo de clases: `bo-` (evita colisiones).
- Componentes: 1 fichero `.html` por componente; todos linkean `./bo.css`.
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

## Accesibilidad y motion
- Botones con `aria-label` cuando solo hay icono.
- Respeta `prefers-reduced-motion`: sin transforms ni transiciones fuertes.

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
