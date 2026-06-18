# Bullfy UI System

La capa de componentes base vive en:

```txt
components/ui/
```

Estos componentes son shadcn extendidos con variantes propias de Bullfy. Los
modulos de dominio deben consumir esta capa en vez de recrear botones, badges o
cards con estilos sueltos.

## Tokens

Los tokens visuales de producto viven en `app/globals.css` y estan expuestos
en `@theme inline` de Tailwind 4.

```tsx
<div className="border-bullfy-neon-blue bg-bullfy-panel/80 text-bullfy-neon-green shadow-neon-green" />
```

Variables fuente:

- `--bullfy-neon-blue`
- `--bullfy-neon-green`
- `--bullfy-neon-red`
- `--bullfy-panel`
- `--bullfy-panel-strong`
- `--bullfy-glass-border`

Utilities disponibles:

- `text-bullfy-neon-blue`, `border-bullfy-neon-blue`, `bg-bullfy-neon-blue/10`
- `text-bullfy-neon-green`, `border-bullfy-neon-green`, `bg-bullfy-neon-green/10`
- `text-bullfy-neon-red`, `border-bullfy-neon-red`, `bg-bullfy-neon-red/10`
- `bg-bullfy-panel`, `bg-bullfy-panel-strong`, `border-bullfy-glass-border`
- `shadow-neon-blue`, `shadow-neon-green`, `shadow-neon-red`, `shadow-glass-blue`

## Button

Uso recomendado:

```tsx
import { Button } from "@/components/ui/button";

<Button variant="neonBlue">Accion primaria</Button>
<Button variant="neonGreen">Crear torneo</Button>
<Button variant="neonRed">Cancelar</Button>
```

Tambien existen variantes solidas:

```tsx
<Button variant="neonBlueSolid">Confirmar</Button>
<Button variant="neonGreenSolid">Publicar</Button>
<Button variant="neonRedSolid">Eliminar</Button>
```

Para links con estilo de boton:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

<Link
  href="/"
  className={cn(buttonVariants({ variant: "neonGreen", size: "lg" }))}
>
  Crear torneo
</Link>
```

## Badge

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="neonBlue">Live</Badge>
<Badge variant="neonGreen">Top 3</Badge>
<Badge variant="neonRed">Riesgo</Badge>
```

## Card

```tsx
import { Card } from "@/components/ui/card";

<Card variant="glass">Contenido</Card>
<Card variant="neonBlue">Arena</Card>
<Card variant="neonGreen">Premios</Card>
<Card variant="neonRed">Alertas</Card>
```

## Regla

Si una nueva variante visual se repite en mas de un modulo, debe agregarse aqui,
no duplicarse en el componente de negocio.
