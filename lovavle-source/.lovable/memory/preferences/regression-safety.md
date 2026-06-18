---
name: Regression Safety Check
description: Before any change, verify it does not break existing working features
type: preference
---
Antes de aplicar cualquier cambio, revisar dependencias y áreas relacionadas para no romper funcionalidad ya estable (overlay de operaciones MT5, viewer/host stream, etc.). Validar después de cada edición.

**Why:** El usuario ha pedido explícitamente preservar todo lo que ya funciona.
**How to apply:** Leer archivos relacionados antes de editar, hacer cambios mínimos y dirigidos, y verificar build/console tras cada edit.
