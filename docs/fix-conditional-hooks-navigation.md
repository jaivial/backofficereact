# Fix: navegación, botones y órbita rotos en el Back Office

## Síntomas

En `/app/backoffice` (y en general en toda la app):

- Ninguna navegación funcionaba.
- Ningún botón de la página de inicio respondía.
- La órbita (`bo-homeOrbit`) no se cargaba.

El HTML se veía correctamente renderizado, pero la página estaba "muerta": nada
reaccionaba al click.

## Causa raíz

**Hooks de React llamados condicionalmente, después de un `return` temprano.**

El patrón repetido era:

```tsx
const session = useAtomValue(sessionAtom);

// ❌ early return ANTES de los hooks
if (!session) return null;

const items = useMemo(() => sidebarItemsForRole(role, ...), [...]);
```

Cuando la sesión pasaba de `null` a presente —el caso normal: SSR sin sesión,
hidratación con sesión— el número de hooks ejecutados cambiaba entre renders y
React lanzaba:

```
Rendered more hooks than during the previous render.
```

Ese error revienta el árbol de React completo. Se pierden todos los event
handlers, por lo que el marcado sigue visible (viene del SSR) pero **nada está
hidratado**: ni navegación, ni botones, ni la órbita.

Como `pages/app/+Layout.tsx` es el layout de *toda* la app, el fallo afectaba a
todas las páginas, no solo a la home.

### Reproducción

Test que confirmó el diagnóstico (`session: null` → sesión presente):

```tsx
const { rerender } = render(<Provider><Layout>x</Layout></Provider>);
pageContext.bo.session = { activeRestaurantId: 1, user: { role: "admin", ... } };
expect(() => rerender(<Provider><Layout>y</Layout></Provider>)).not.toThrow();
```

Antes del arreglo fallaba con `Rendered more hooks than during the previous
render.`; después pasa.

## Archivos corregidos

| Archivo | Problema |
| --- | --- |
| `pages/app/+Layout.tsx` | `useEffect` tras `if (!session) return`. Movido antes del early return. Layout de toda la app → mataba la navegación en cada página. |
| `pages/app/backoffice/backoffice.tsx` | Los tres `useMemo` (incluido el que calcula los ángulos de la órbita) tras `if (!session) return null`. Causa directa de que no se cargara la órbita. |
| `pages/app/app/app-layout.tsx` | Mismo patrón de `useEffect` tras early return. |
| `ui/forky/ForkyChart.tsx` | `useReducedMotion()` llamado tras un return condicional. |
| `pages/app/reservas/tables/hooks/tables.ts` | Eliminado `createPersistLayoutDebouncer`: código muerto (sin ningún uso) que llamaba `useCallback` sin ser un hook. |

La corrección consiste siempre en mover **todos** los hooks por encima de
cualquier `return` condicional, usando acceso opcional donde haga falta:

```tsx
const { role, sectionAccess, roleImportance, name } = session?.user ?? {};
const items = useMemo(() => sidebarItemsForRole(role, ...), [...]);

// ✅ early return DESPUÉS de todos los hooks
if (!session) return null;
```

## Por qué se coló

`eslint.config.js` registraba el plugin `react-hooks` pero **no activaba ninguna
de sus reglas**, así que estos bugs eran completamente invisibles para el lint.

Se activó:

```js
'react-hooks/rules-of-hooks': 'error',
```

con una excepción para `**/+data.ts`, ya que el `useConfig` de Vike no es un hook
de React y generaba falsos positivos.

## Verificación

- `tsc --noEmit` y `eslint` limpios.
- 872 tests pasan (134 ficheros).
- Build de producción + E2E real con login: los 11 nodos de la órbita navegan
  correctamente en escritorio (1600×1000) y móvil (390×844), con 0 errores de
  página.

## Nota sobre el build

Durante la investigación apareció este error al servir el build:

```
TypeError: jsxDEV is not a function
```

No estaba relacionado con el bug: se debía a compilar sin `NODE_ENV=production`.
El script `build` del `package.json` ya lo incluye:

```json
"build": "NODE_ENV=production vike build"
```

Si se despliega invocando `vike build` directamente, hay que exportar esa
variable o el bundle de servidor quedará en modo desarrollo.
