# Memory: features/admin/direct-structurer-logic
Updated: now

Módulo Estructurador Directo (tab "Estructurador" en /ibs): Permite a roles 'admin' y 'operaciones' crear jerarquías de Sub-IB directamente bajo un IB existente, sin pasar por flujos de solicitud (ib_external_requests), aprobación de BD ni colas de espera.

## Funcionalidades:
- **Selección de IB existente**: Busca y selecciona cualquier IB activo/submitted
- **Detección de portal activo**: Al ingresar el correo del Sub IB, verifica automáticamente si ya tiene usuario auth + rol ib_externo. Si ya tiene portal, no se re-invita
- **Detección de Sub IB existente**: Si el correo ya está en sub_ibs bajo ese IB, marca como "Ya existe" y no permite duplicar
- **Invitación opcional al portal**: Checkbox por Sub IB para auto-ejecutar invite-ib-externo (crear auth user + temp password + email)
- **Creación masiva**: Permite agregar múltiples Sub IBs en una sola operación (acordeón expandible)
- **Compensación directa**: Configura $/lote por Sub IB basado en el Master IB
- **Auto-configurado en ops_queue**: Marca automáticamente el status como 'configurado' en la cola de operaciones
- **Sin duplicación de flujo**: No crea ib_external_requests ni requiere aprobación manual

## Componente: DirectStructurer.tsx
Ubicado en src/components/admin/DirectStructurer.tsx, se renderiza como tab en IBs page solo para admin/operaciones.
