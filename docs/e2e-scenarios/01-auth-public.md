# E2E Edge — Pantallas 1-4: Auth / páginas públicas

Credenciales: `admin@villacarmen.com` / `admin123` (role root).

## 1. `/login`
Interacciones reales de usuario:
- Login con credenciales válidas → redirige a `/app/backoffice`.
- Login con credenciales erróneas → toast de error, sin crash.
- Enviar formulario vacío → no navega (validación `required`).
- Identificador con espacios/blancos al pegar → ¿trim o error? (edge).
- Botón deshabilitado mientras `busy`.
- `mustChangePassword` → redirige a `/change-password` (edge: no probable con admin root).

Edge cases:
1. Email inexistente → error toast, permanece en `/login`.
2. Email válido + password incorrecta → error toast.
3. Identificador con espacios alrededor → comportamiento consistente (sin crash).
4. Submit doble rápido → sin doble navegación/duplicado.

## 2. `/confirm`, `/cancel`, `/update-rice`
Interacciones reales de usuario (páginas públicas de reserva):
- Sin `?id=` → mensaje de error + enlace "Volver al inicio".
- `?id=<no-numérico>` → mensaje de error (id inválido).
- `?id=<inexistente>` → "Reserva no encontrada".
- `?id=<válido>` → muestra datos de la reserva (siempre que exista una en dev).
- Confirmar/cancelar/actualizar arroz con formulario → submit con datos.
- Enlace teléfono del restaurante (cancel/update-rice).

Edge cases:
1. Falta `id` en la URL.
2. `id` no numérico (`abc`, `1.5`, `-3`).
3. `id` no existente (p.ej. 999999999) → error controlado, no 500.
4. `id=0` → id inválido.

## 3. `/onboarding/<guid>`
Interacciones reales de usuario:
- Validar invitación (GET onboarding por guid).
- Completar onboarding 3 pasos (datos, avatar, password).
- Subir avatar (webp ≤200KB).
- Enlace a login si token inválido/expirado.

Edge cases:
1. Sin `guid` → "Onboarding inválido".
2. `guid` aleatorio/inválido → error de API "Onboarding inválido o expirado".
3. Doble submit en pasos → sin duplicados (busy guard).

## 4. `/invitacion/<token>`, `/reset-password/<token>`
Interacciones reales de usuario:
- Validar invitación activa → "Empezar" onboarding.
- Reset password: token válido → nuevo password 2 veces.
- Mismatch de passwords → error inline "Las passwords no coinciden".
- Enlace "Ir a login".

Edge cases:
1. Invitación token inválido → "No se pudo validar la invitación" + Ir a login.
2. Reset token inválido → "Enlace no válido" + Ir a login.
3. Reset passwords no coinciden → error inline.
4. Campos vacíos en reset → "Debes completar ambos campos".

## 5. `/change-password`
Interacciones reales de usuario:
- Acceso autenticado (forzado por `mustChangePassword`).
- Cambiar password: actual + nueva + confirmar.

Edge cases:
1. Sin sesión → redirige a `/login`.
2. Nueva password != confirmación → error.
3. Password actual incorrecta → error backend.

## 6. `/m` (app móvil) y `/`
Edge cases:
1. `/` sin sesión → redirige a `/login`.
2. `/m/login` sin sesión → muestra login.
3. `/m` sin sesión → redirige a login.
