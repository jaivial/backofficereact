# Plan: persistir estado del acordeón "Reparto por hora" + calendar picker con ocupación

> **Estado: implementado.** Fases 1-6 completas. Validado con `tsc`, `lint:jsx`, vitest,
> `vike build`, `go build ./...` y `go test ./internal/api/`.

Scope: `backoffice/` (+ `backend/` para el endpoint/whitelist).
Páginas afectadas: `/app/reservas/config?date=YYYY-MM-DD` y `/app/config` (tab Restaurante).

---

## Estado actual (investigado)

- Widget: `ui/widgets/HourSplitConfig/HourSplitConfig.tsx:53` → `const [open, setOpen] = useState(true)`.
  Estado local, no persistido. Trigger en `data-testid="hour-split-config-trigger"`.
- Consumidores:
  - `pages/app/reservas/config/config.tsx:418` (variant `day`, datos de `+data.ts`).
  - `pages/app/config/functionalComponents/ConfigRestaurante/ConfigRestaurante.tsx:350` (variant `default`).
- Ya existe un store genérico de preferencias por usuario+restaurante:
  - Tabla `user_preferences` (`backend/internal/db/migrations/097_user_preferences.sql`).
  - `GET /api/admin/me` devuelve `session.preferences` (`backoffice_types.go:29`).
  - `PUT /api/admin/me/preferences` (`backoffice_preferences.go`), con whitelist
    `allowedBOPreferences` (hoy solo `reservasDisplayMode`).
  - Cliente: `api.auth.setPreference(key, value)` (`api/client.ts:813`).
  - Precedente de uso: `pages/app/reservas/reservas.tsx:412` + `pages/app/reservas/+data.ts:28`.
  - El proxy SSR invalida la caché de sesión en cada PUT (`server/index.ts:716`).
- Calendar picker objetivo: `ui/widgets/MonthCalendarDatePicker.tsx` (usa `MonthCalendar`,
  ocupación por día vía `CalendarDay[]`). Lógica de mes/navegación hoy inline en
  `pages/app/reservas/tables/tables.tsx` (`calendarView`, `onPrevMonth`/`onNextMonth`,
  `api.calendar.getMonth`, líneas ~1163, ~1617, ~3615-3657, ~4876).
- Picker actual en config: `DateDropdown` (`pages/app/reservas/config/config.tsx:232`).

## Decisiones (asunciones, fáciles de revisar)

1. **[CONFIRMADO] Reusar `user_preferences` + `PUT /api/admin/me/preferences`** en vez de crear
   tabla/endpoint nuevos. Ya es el mecanismo canónico de estado de UI por usuario, hidrata gratis en
   SSR con la sesión (sin round-trip extra) y evita duplicar CRUD. No se crea
   `/api/admin/config/ui-state`.
2. **Dos claves independientes** (el usuario puede querer el detalle abierto en el día y cerrado en
   defaults): `hourSplitDetailsOpenDay` y `hourSplitDetailsOpenDefault`. Valores `"1"` / `"0"`.
3. Ámbito de la preferencia: **por usuario + restaurante activo** (no por fecha). Cambiar de día no
   resetea el acordeón.
4. El PUT es **fire-and-forget optimista**: se actualiza la UI y el átomo de sesión al instante; si
   falla, toast de error (mismo patrón que `reservasDisplayMode`). No se revierte el pliegue.
5. El widget queda **controlable pero retrocompatible** (OCP): si no se pasan `open`/`onOpenChange`
   sigue siendo no controlado con `defaultOpen` (default `true`), como hoy.

---

## Fase 1 — Backend: whitelist de las nuevas claves

Ficheros: `backend/internal/api/backoffice_preferences.go`,
`backend/internal/api/backoffice_preferences_test.go`.

1. TDD: test que `PUT /api/admin/me/preferences` con
   `{"key":"hourSplitDetailsOpenDay","value":"0"}` responde `success:true` y persiste; y que un valor
   fuera de `{"0","1"}` responde `success:false`.
2. Añadir a `allowedBOPreferences`:
   ```go
   "hourSplitDetailsOpenDay":     {"0": {}, "1": {}},
   "hourSplitDetailsOpenDefault": {"0": {}, "1": {}},
   ```
3. Sin migración (la tabla ya es genérica). El "CRUD" queda cubierto: **read** en `GET /api/admin/me`,
   **create/update** por upsert en el PUT; delete no aplica (se sobrescribe el valor).
4. Verificar: `go test ./internal/api/... && go build ./...`.

## Fase 2 — Widget `HourSplitConfig` controlable

Ficheros: `ui/widgets/HourSplitConfig/HourSplitConfig.tsx`, `HourSplitConfig.test.tsx`.

1. TDD en `HourSplitConfig.test.tsx`:
   - `defaultOpen={false}` → `hour-split-cards` con `hidden`.
   - `open={false}` + click en trigger → llama `onOpenChange(true)`.
   - Sin props nuevas → comportamiento actual (abierto) intacto.
2. Props nuevas (todas opcionales):
   ```ts
   open?: boolean;              // modo controlado
   defaultOpen?: boolean;       // modo no controlado (default true)
   onOpenChange?: (next: boolean) => void;
   ```
3. Sustituir `useState(true)` por patrón controlado/no-controlado
   (`const isControlled = open !== undefined; const value = isControlled ? open : internal`).
   `hidden={!value}` en `hsplit-cards` y en `hsplit-totals`.
4. Sin cambios de estilos ni de markup (respetar reglas `data-*` de AGENTS.md).

## Fase 3 — `/app/reservas/config`: hidratar + persistir

Ficheros: `pages/app/reservas/config/+data.ts`, `config.tsx` (+ nuevo test).

1. `+data.ts`: leer `pageContext.bo?.session?.preferences?.hourSplitDetailsOpenDay` y devolver
   `hourSplitDetailsOpen: raw !== "0"` (default abierto). Test unitario del mapeo
   (patrón de `pages/app/reservas/data.test.ts`).
2. `config.tsx`:
   - `const [hourSplitOpen, setHourSplitOpen] = useState(data.hourSplitDetailsOpen)` → primer paint
     ya con el estado correcto, sin flash.
   - `onOpenChange` → set local + patch de `sessionAtom.preferences` +
     `api.auth.setPreference("hourSplitDetailsOpenDay", next ? "1" : "0")`, toast en error
     (copiar `changeDisplayMode` de `reservas.tsx:412`).
   - Pasar `open`/`onOpenChange` al `HourSplitConfigWidget` (línea 418).

## Fase 4 — `/app/config`: hidratar + persistir

Ficheros: `pages/app/config/+data.ts`, `pages/app/config/config.tsx`,
`functionalComponents/ConfigRestaurante/ConfigRestaurante.tsx`.

1. `/app/config/+data.ts` hoy no lee sesión: añadir
   `hourSplitDetailsOpen` desde `pageContext.bo.session.preferences.hourSplitDetailsOpenDefault`
   (mismo default `true`). El resto de la página sigue cargando client-side.
2. Pasar el valor por props hasta `ConfigRestauranteContent` y cablear `open`/`onOpenChange` en el
   widget (línea 350), con `setPreference("hourSplitDetailsOpenDefault", ...)`.
3. Test de render: con preferencia `"0"` el detalle arranca plegado.

## Fase 5 — Calendar picker con ocupación en `/app/reservas/config`

Ficheros: nuevo `ui/widgets/useMonthCalendarDays.ts` (o
`pages/app/reservas/hooks/`), `pages/app/reservas/config/config.tsx`,
`pages/app/reservas/tables/tables.tsx` (refactor opcional).

1. Extraer un hook mínimo con lo que hoy está inline en `tables.tsx`:
   ```ts
   useMonthCalendar(selectedDate) => { year, month, days, loading, onPrevMonth, onNextMonth, onSelectDate }
   ```
   - Estado `calendarView` derivado de la fecha seleccionada.
   - `useEffect` → `api.calendar.getMonth({ year, month })` (endpoint ya existente,
     `api/client.ts:845`), guarda `CalendarDay[]`.
   - `onSelectDate` actualiza fecha, ajusta el mes visible y hace `history.replaceState`
     con `?date=` (mismo comportamiento que `tables.tsx:3615`).
   - Tests del hook: cambio de mes en los bordes (enero→diciembre año-1, diciembre→enero año+1) y
     refetch al cambiar de mes.
2. En `config.tsx` sustituir `<DateDropdown .../>` (línea 232) por
   `<MonthCalendarDatePicker value={date} onChange={onDateChange} year month days loading
   onPrevMonth onNextMonth data-testid="reservas-config-date-picker" />`, manteniendo el
   `onDateChange` actual (recarga de datos del día).
3. `tables.tsx`: migrar su lógica inline al hook para evitar duplicación
   (opcional, solo si no arrastra riesgo; si no, dejarlo y documentar la deuda).
4. Comprobar CSS: `MonthCalendarDatePicker` usa portal `#bo-portal`; verificar que el
   `PageToolbar` de config no recorta el popover (z-index/overflow).

## Fase 6 — Verificación y cierre

Resultado real:
- `tsc --noEmit` ✅ · `lint:jsx` (605 ficheros) ✅ · `vike build` ✅
- vitest (hooks + HourSplitConfig + `+data`): 34 tests ✅
- `go build ./...` ✅ · `go test ./internal/api/` ✅
- Nota: `ConfigRestaurante.test.tsx` se cuelga al ejecutarse; **fallo preexistente**
  (reproducido con los cambios stasheados), fuera del alcance de esta tarea.

```bash
# backoffice
pnpm lint:jsx && pnpm lint:all && pnpm test && pnpm build
# backend
go test ./... && go build ./...
```
- E2E manual/Playwright:
  1. Abrir `/app/reservas/config?date=2026-08-18`, plegar el acordeón → ver `PUT /api/admin/me/preferences`.
  2. Recargar → llega plegado desde SSR (sin parpadeo).
  3. Desplegar → nuevo PUT; recargar → desplegado.
  4. Repetir en `/app/config` y comprobar que **no** afecta a la otra página.
  5. Picker: navegar meses, ver ocupación/estado de día por celda, seleccionar fecha → cambia `?date=`
     y recarga la config del día.

## Riesgos

- Caché de sesión SSR: ya se invalida en el PUT (`server/index.ts:716`); si se cambiara la ruta del
  endpoint habría que actualizar esa condición.
- Sesión inexistente (SSR sin `bo.session`): default abierto, sin PUT.
- Multi-restaurante: la preferencia es por restaurante activo; cambiar de restaurante reinicia al default.
