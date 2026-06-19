# Implementacion de avatares

## Estado en lovable-source

`lovable-source` tiene una implementacion bastante mas avanzada que este repo:

- Usa Avaturn como proveedor principal de avatar 3D.
- Tiene una Edge Function `avaturn-session` que crea/reusa un usuario anonimo en Avaturn y devuelve una session URL short-lived.
- El frontend monta el editor con `@avaturn/sdk`.
- Escucha el evento `export` del SDK para recibir una URL o data URL del avatar GLB.
- Guarda datos en `tournament_users`:
  - `avatar_url`: imagen/avatar 2D/fallback.
  - `avatar_config`: JSON con seed/config, `avaturn_user_id`, `avaturn_avatar_id`, `gender`, etc.
  - `avatar_3d_url`: URL final del modelo GLB.
  - `preferred_pose`: pose/animacion activa.
- Tiene un renderer 3D con `@react-three/fiber`, `@react-three/drei`, `three` y animaciones GLB publicas de Ready Player Me.
- Si Avaturn devuelve un GLB como `data:...base64`, `tournament-profile-update` lo sube a Storage (`tournament-avatars-3d`) y guarda una URL publica.
- Tambien conserva una opcion legacy de Ready Player Me iframe, pero el camino principal en la UI actual es Avaturn/Bullfy Avatar.

Archivos clave revisados:

- `lovavle-source/supabase/functions/avaturn-session/index.ts`
- `lovavle-source/supabase/functions/tournament-profile-update/index.ts`
- `lovavle-source/src/pages/tournament/TournamentAvatarStudio.tsx`
- `lovavle-source/src/pages/tournament/components/TournamentAvatar.tsx`
- `lovavle-source/src/pages/tournament/components/TournamentAvatar3D.tsx`
- `lovavle-source/src/pages/tournament/components/avatarAnimations.ts`
- `lovavle-source/supabase/migrations/20260517063431_03689b3b-0c24-4bac-b37e-4d22eca4ae92.sql`
- `lovavle-source/supabase/migrations/20260519172016_c86a7bea-c678-44e7-83df-5b165ffa5698.sql`
- `lovavle-source/supabase/migrations/20260521224807_7277d69a-b28d-4b3a-a581-57c61dadaf02.sql`

## Estado en este repo

Este repo tiene una pantalla mock en `/profile/avatar`.

Actualmente:

- No hay persistencia real de avatar en DB.
- `CurrentSessionUser.avatarUrl` siempre cae en `/avatars/karlos.svg`.
- `demo_traders` no tiene columnas de avatar.
- No existe API propia para iniciar Avaturn, guardar avatar o consultar avatar.
- Ya tenemos `@react-three/fiber` y `three`, pero faltan dependencias necesarias para copiar el renderer de Lovable:
  - `@react-three/drei`
  - `@avaturn/sdk`
  - `@dicebear/core`
  - `@dicebear/collection`
- No tenemos Storage tipo Supabase bucket. Tenemos Postgres local y archivos locales del proyecto.

## Como funciona Avaturn

Segun la documentacion oficial de Avaturn:

- El backend crea un usuario anonimo con `POST /users/new`.
- El backend crea una sesion con `POST /sessions/new`.
- La session URL es temporal y se debe crear una nueva cada vez que el usuario abre el editor.
- Conviene guardar la relacion entre nuestro usuario y `avaturn_user_id` para que pueda editar su avatar anterior.
- La exportacion puede ser:
  - `httpURL`: URL persistente al GLB.
  - `dataURL`: GLB en base64 generado en cliente.

Fuente:

- https://docs.avaturn.me/docs/integration/api/basic_flow/
- https://docs.avaturn.me/docs/integration/web/sdk/introduction/

## Propuesta para nuestra primera demo

Objetivo: tener un flujo completo y simple:

1. Usuario entra a `/profile/avatar`.
2. Si no tiene avatar, ve CTA `Crear Bullfy Avatar`.
3. Front llama `POST /api/profile/avatar/session`.
4. Backend crea/reusa usuario Avaturn y devuelve `sessionUrl`.
5. Front monta `@avaturn/sdk` en la pagina.
6. Usuario crea/exporta avatar.
7. Front recibe `avatar_3d_url` y `avaturn_avatar_id`.
8. Usuario pulsa `Guardar avatar`.
9. Front llama `POST /api/profile/avatar`.
10. Backend valida y guarda avatar en DB.
11. Perfil, header, ranking, arena y podium pueden leer el avatar del usuario.

## DB propuesta

Agregar columnas a `demo_traders`:

```sql
alter table demo_traders
  add column if not exists avatar_url text,
  add column if not exists avatar_config jsonb not null default '{}'::jsonb,
  add column if not exists avatar_3d_url text,
  add column if not exists avatar_provider text,
  add column if not exists avaturn_user_id text,
  add column if not exists avaturn_avatar_id text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists preferred_pose text not null default 'idle';
```

Para auditoria simple, agregar tabla opcional:

```sql
create table if not exists user_avatar_events (
  id text primary key,
  trader_id text not null references demo_traders(id) on delete cascade,
  provider text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Almacenamiento del GLB

Hay tres caminos:

### Opcion A: guardar solo httpURL de Avaturn

Mas simple para demo.

- Si Avaturn exporta `httpURL`, guardamos esa URL en `demo_traders.avatar_3d_url`.
- No necesitamos storage propio.
- Riesgo: dependemos de que la URL sea persistente segun la configuracion del proyecto Avaturn.

### Opcion B: aceptar dataURL y guardar archivo local

Util para demo local sin Supabase Storage.

- Si el SDK devuelve `data:model/gltf-binary;base64,...`, el backend decodifica y guarda `.glb` en una carpeta local como `public/uploads/avatars/{traderId}/{uuid}.glb`.
- Guardamos `/uploads/avatars/{traderId}/{uuid}.glb` en DB.
- Sirve para desarrollo, pero no es ideal para produccion ni para deploy serverless.

### Opcion C: storage real

Mejor para produccion.

- Cloudflare R2, S3, Supabase Storage, Vercel Blob o similar.
- El backend sube el GLB y guarda URL final en DB.
- Recomendado antes de produccion.

Para esta primera demo, recomendacion: empezar con A y dejar fallback B si Avaturn devuelve dataURL.

## API propuesta

### `POST /api/profile/avatar/session`

Crea o reusa sesion Avaturn.

Entrada:

```json
{
  "avaturnAvatarId": "optional"
}
```

Salida:

```json
{
  "sessionUrl": "https://...",
  "avaturnUserId": "..."
}
```

Responsabilidad:

- Leer usuario actual (`getCurrentDemoTraderId`).
- Leer `avaturn_user_id` de DB.
- Si no existe, crear usuario Avaturn y guardarlo.
- Crear session Avaturn.
- Devolver URL temporal.

### `POST /api/profile/avatar`

Guarda avatar exportado.

Entrada:

```json
{
  "avatar3dUrl": "https://... o data:model/gltf-binary;base64,...",
  "avatarConfig": {
    "provider": "avaturn",
    "gender": "masculine",
    "avaturn_user_id": "...",
    "avaturn_avatar_id": "..."
  }
}
```

Responsabilidad:

- Validar que `avatar3dUrl` sea `https://...` o data URL GLB permitida.
- Si es data URL, subir/guardar GLB y convertirlo a URL.
- Persistir en `demo_traders`.
- Devolver usuario/avatar actualizado.

### `GET /api/profile/avatar`

Opcional, para consultar avatar actual sin cargar todo el perfil.

## UI propuesta

Primera version:

- Reemplazar mock de `/profile/avatar` por un studio real.
- Usar la identidad visual actual de Bullfy.
- Panel izquierdo: preview 3D si existe, fallback 2D/iniciales si no.
- Panel derecho: editor Avaturn embebido.
- Botones:
  - `Crear Bullfy Avatar`
  - `Editar Bullfy Avatar`
  - `Guardar avatar`
  - `Quitar avatar`

Despues:

- Mostrar avatar 3D en perfil.
- Mostrar avatar en header/app shell.
- Mostrar avatar en ranking, lobby, ArenaTV y podio.
- Agregar poses con `preferred_pose`.

## Que necesito de tu parte

Para implementar con Avaturn real:

- `AVATURN_API_KEY`.
- Confirmar si el proyecto Avaturn esta configurado para exportar `httpURL` o `dataURL`.
- Si quieres storage propio desde ya:
  - proveedor elegido: Supabase Storage, S3, Cloudflare R2, Vercel Blob, etc.
  - keys/bucket.
- Confirmar si la primera demo debe permitir:
  - solo crear/guardar avatar,
  - o tambien elegir poses desde el inicio.

Para implementar sin keys todavia:

- Puedo dejar DB + API + UI lista con modo mock/local.
- El boton `Crear Bullfy Avatar` quedaria deshabilitado o simulado hasta tener `AVATURN_API_KEY`.
- Podemos guardar avatar 2D generado por DiceBear/local config mientras llega la key.

## Recomendacion

Implementaria en dos fases:

1. **Base persistente local**: migracion DB, servicios, API de guardar/leer avatar, y conectar `/profile/avatar` para guardar `avatar_config`, `avatar_3d_url`, `preferred_pose`.
2. **Proveedor Avaturn**: agregar `AVATURN_API_KEY`, instalar `@avaturn/sdk`, crear session route, montar el editor real y guardar el GLB exportado.

Esto nos deja una demo funcional aunque el proveedor externo falle, y evita que el avatar sea solo UI sin persistencia.
