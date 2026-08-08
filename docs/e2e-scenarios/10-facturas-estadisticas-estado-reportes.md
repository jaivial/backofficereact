# E2E Edge — Pantallas 15-18: Facturas, Estadísticas, Estado de Cuenta, Reportes

## Facturas (`/app/facturas`)
- Tabs Resumen/Añadir, filtros de facturas, búsqueda.
- Edge: toggle de filtros; navegar a tab añadir; filtros con selección.

## Estadísticas (`/app/estadisticas`)
- Panel financiero con métricas; acordeón de filtros.
- Edge: toggle filtros; cabecera visible con datos.

## Estado de Cuenta (`/app/estado-cuenta`)
- Formulario cliente + fechas + generar estado.
- Edge: generar sin cliente → validación/error controlado; cargar clientes.

## Reportes (`/app/reportes`)
- Reportes IVA con periodo y generación.
- Edge: sección IVA presente; generación sin 500.

## Hallazgos
- Estadísticas: Recharts emite warning `width(-1) height(-1)` (los charts se renderizan
  antes de que el contenedor tenga dimensiones). No rompe la página pero degrada el
  render inicial de los gráficos. Pendiente de fix de layout.
- Estado de Cuenta: el botón "Generar Estado de Cuenta" está `disabled` hasta elegir
  cliente (validación correcta).

