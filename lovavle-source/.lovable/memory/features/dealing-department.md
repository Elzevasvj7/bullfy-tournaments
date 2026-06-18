---
name: Dealing Department Role
description: Rol 'dealing' para el departamento de Dealing. Solicitudes en Operaciones pueden dirigirse a Ops o Dealing. Si es Dealing, IB no se asocia y se notifica al equipo Dealing.
type: feature
---
- Rol `dealing` agregado al enum `app_role`
- Columna `target_department` en `ops_requests` (valores: 'operaciones' | 'dealing', default 'operaciones')
- Cuando target_department = 'dealing': IB Asociado se desactiva y no se puede seleccionar
- Notificaciones (bell + email) se envían a usuarios con rol 'dealing' cuando la solicitud va a dealing
- Triggers `notify_new_ops_request` y `notify_ops_request_change` actualizados para rutear notificaciones según `target_department`
- `isDealing` disponible en `useAuth`
- Dealing puede ver la cola completa en Operaciones, tomar y completar solicitudes asignadas a ellos
