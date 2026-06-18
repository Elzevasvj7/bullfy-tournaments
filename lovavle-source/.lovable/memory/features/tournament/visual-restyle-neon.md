---
name: Tournament Torneum Neon Restyle
description: Bullfy Tournament visual restyle — Torneum Neon theme (cyan/magenta/lime sobre #060B1F), Orbitron/Space Grotesk, glitch + shimmer hero, scoped vía .tournament-neon (no afecta resto de la app)
type: design
---
## Scope: solo /tournament/*

Toda la estética neon vive dentro del wrapper `.tournament-neon` en `src/pages/tournament/TournamentLayout.tsx`. NO toca tokens globales del resto de la app (Bullfy IB System sigue con su dark blue/Figtree).

## Paleta
- `--t-bg` `#060B1F` (deep navy)
- `--t-surface` `#0a1129`
- `--t-cyan` `#00E5FF` (primary accent, "Standard")
- `--t-magenta` `#FF2EC4` ("Elite")
- `--t-lime` `#B6FF3D` ("Gratuito", BP)

## Tipografía
- Display: **Orbitron** (`.t-display`) — headings, prize pool
- Body: **Space Grotesk** (default en `.tournament-neon`)
- Mono: **JetBrains Mono** (`.t-mono`) — countdowns, números

Fuentes cargadas en `src/index.css` (línea 1 import).

## Efectos clave
- `.t-glitch` — CSS glitch sutil con `::before`/`::after` clip-path (cyan + magenta). Requiere `data-text` attr.
- `.t-shimmer` — gradient text animado (cyan → lime → cyan, 7s loop).
- `.t-scanlines` — overlay scanlines absolute para hero cards.
- Background fixed: grid cyan 56x56 con radial mask en `.tournament-neon::before`.

## Cards de torneo
Color de acento depende de `type`: elite=magenta, paid=cyan, free=lime. Hover lift -6px + glow color del acento.

## Avatares "Ready Player One" con overlay de foto real
- `AvatarConfig.face_photo_url` (jsonb dentro de `tournament_users.avatar_config`) almacena dataURL 256x256 JPEG.
- `TournamentAvatar` componente compone la foto real sobre el avatar 2D con `mask-image` radial (feathered).
- Studio: nueva tab "Cara" en `TournamentAvatarStudio.tsx` → resize client-side, sin migration ni bucket.
- Es opcional: si no hay foto, queda el avatar DiceBear / 3D RPM normal.
