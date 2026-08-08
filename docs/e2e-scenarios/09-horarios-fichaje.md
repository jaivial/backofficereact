# E2E Edge — Pantallas 13-14: Horarios y Fichaje

Rutas: `/app/horarios`, `/app/horarios/turnos`, `/app/fichaje`.

## Horarios
### Interacciones reales de usuario
- Ver calendario mensual con ocupación por día.
- Navegar meses (anterior/siguiente).
- Seleccionar un día → detalle de turnos.
- Tabs calendario: Miembros / Reservas.
- Panel tabla: Tabla / Turnos.

### Edge cases
1. Navegación de mes prev/next sin romper el calendario.
2. Seleccionar un día → URL refleja la fecha.
3. Día sin turnos → detalle vacío sin crash.

## Fichaje
### Interacciones reales de usuario
- Estado de conexión WS (fichaje-connection).
- Iniciar fichaje (DNI + contraseña).
- Parar fichaje activo (si hay).
- Ver miembros con estado.

### Edge cases
1. Enviar formulario vacío → error "Introduce DNI y contraseña para fichar".
2. DNI inexistente → error de backend sin crash.
3. Estado WS visible (conectado/desconectado).
