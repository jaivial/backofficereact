# E2E Edge — Pantalla 12: Miembros

Rutas: `/app/miembros`, `/app/miembros/roles`, `/app/miembros/@memberId`, `/app/miembros/mi-horario`.

## Interacciones reales de usuario
- Listar miembros (32) con badges de rol y horas de contrato.
- Añadir miembro (modal con datos de acceso/perfil).
- Ver detalle de un miembro (click card → `/app/miembros/{id}`).
- Tabs Miembros / Roles.
- Enviar WhatsApp a miembro.

## Edge cases
1. Card de miembro abre detalle correcto (id en URL).
2. Modal añadir miembro: abrir y cerrar sin guardar.
3. Detalle de miembro inexistente (`/app/miembros/999999999`) → sin 500.
4. Tab Roles carga catálogo de roles.
