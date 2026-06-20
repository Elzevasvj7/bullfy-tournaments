# Plan de mejora UI gaming/esports

## Contexto

La app ya tiene una base visual interesante con fondo oscuro, acentos neon magenta, cyan y verde, y una direccion general cercana a torneos competitivos. El problema actual no es la paleta, sino que algunas decisiones visuales siguen sintiendose genericas: exceso de bordes redondeados, cards anidadas, glows permanentes, gradientes tipo spray y una pagina de perfil que no se siente integrada con el resto de la experiencia.

El objetivo de este plan es mejorar lo existente sin asumir todavia un rediseño total. La direccion visual debe acercarse mas a gaming, esports, versus screen, roster UI y player hub, manteniendo jerarquia, legibilidad y funcionalidad.

## Principios de direccion visual

- Usar formas mas duras, tecnicas y angulares.
- Reducir el uso de `rounded-lg`, `rounded-xl`, `rounded-2xl` y `rounded-3xl`.
- Mantener neon como acento, no como decoracion constante.
- Evitar el abuso de radial gradients, blur, glow y fondos tipo spray.
- Reducir cards anidadas: no todo bloque destacado necesita ser otra card.
- Priorizar paneles, divisores, labels, barras y agrupaciones tecnicas.
- Hacer que botones, links y tabs importantes tengan lenguaje visual propio.
- Usar animaciones con intencion, no como ruido permanente.

## 1. Auditoria visual del proyecto

Revisar las paginas y componentes principales:

- `tournaments`
- detalle de torneo
- `wallet`
- `profile`
- `clans`
- `arena`
- `auth`
- componentes compartidos de `components/ui`
- componentes compartidos de `shared`

Durante la auditoria hay que marcar:

- Dónde hay exceso de bordes redondeados.
- Dónde hay cards dentro de cards.
- Dónde hay glow o shadow permanente sin necesidad.
- Dónde hay demasiados gradients o radial gradients.
- Qué botones, links y tabs deben tener tratamiento gaming.
- Qué componentes deben quedarse mas funcionales y no decorarse demasiado.

## 2. Sistema visual base

Definir una convencion visual mas clara para toda la app:

- Paneles grandes: bordes duros, poco o ningun radio.
- Cards de entidades: rectangulares, con borde fino y detalles tecnicos.
- Badges, labels, tabs y algunos CTAs: usar `polygon-shape`.
- Inputs, selects, dialogs y menus: conservar radio minimo por usabilidad, pero sin estetica SaaS.
- Icon buttons pequeños: mantener forma compacta, no forzar polygon si afecta lectura o click target.

Regla sugerida de radios:

- Default visual gaming: `rounded-none` o `rounded-sm`.
- Elementos funcionales pequeños: maximo `rounded-md`.
- Evitar `rounded-xl`, `rounded-2xl`, `rounded-3xl` salvo excepciones justificadas.

## 3. Refactor de `polygon-shape`

La clase `polygon-shape` ya existe y es una buena base porque usa pseudo-elemento con `skewX`, sin depender de `clip-path`.

Mejoras propuestas:

- Hacerla mas reusable con variables CSS:
  - `--polygon-bg`
  - `--polygon-border`
  - `--polygon-skew`
  - `--polygon-inset`
- Agregar soporte para estados hover/focus sin repetir utilidades complejas.
- Definir variantes practicas para labels, tabs y CTAs.
- Mantener el contenido sin deformarse mientras el fondo tiene inclinacion.

Aplicacion prioritaria:

- Badges de tier/status.
- Tabs de filtros.
- Links secundarios importantes.
- CTAs principales seleccionados.
- Acciones visuales en wallet y perfil.

No aplicar de forma indiscriminada en:

- Inputs.
- Selects.
- Switches.
- Menus.
- Icon buttons pequeños.
- Acciones destructivas secundarias.

## 4. Refactor de `animated-button`

La clase `a.animated-button` necesita limpieza antes de extenderla. Actualmente tiene duplicacion y transiciones demasiado largas.

Objetivos del refactor:

- Convertirla en una clase reusable para `a`, `button` y componentes con `asChild`.
- Eliminar duplicacion.
- Reemplazar transiciones de `50s` por tiempos razonables entre `180ms` y `280ms`.
- Mantener la idea de barrido diagonal, pero mas limpia y premium.
- Agregar soporte para:
  - `hover`
  - `focus-visible`
  - `disabled`
  - `aria-disabled`
  - `prefers-reduced-motion`

Aplicacion recomendada:

- CTA principal de torneo.
- Link `Ver detalles`.
- Acciones principales de wallet.
- Acciones principales de perfil.
- Tabs o filtros principales cuando tenga sentido.

No usarla en todos los links pequeños para evitar saturacion visual.

## 5. Reduccion de brillo, spray y gradientes

La app debe conservar los colores neon, pero reducir el brillo constante.

Reglas:

- Una capa ambiental por pagina es suficiente.
- Evitar radial gradients repetidos dentro de cada card.
- Default debe ser mas oscuro, tecnico y sobrio.
- Hover/active/live son los momentos correctos para encender acentos.
- Reducir sombras tipo `shadow-neon-*` en botones y badges normales.
- Reservar glow mas fuerte para estados especiales: torneo activo, seleccion, live, alerta o CTA principal.

## 6. Menos cards anidadas

El problema no es usar el componente `Card`, sino convertir cualquier informacion en una card independiente.

Reglas:

- Un bloque grande puede ser panel.
- Dentro del panel, usar filas, barras, labels, divisores y grupos compactos.
- Las cards deben reservarse para entidades repetibles:
  - torneos
  - participantes
  - movimientos
  - historial
  - items de lista

Refactor prioritario:

- Profile dashboard.
- Wallet overview.
- Tournament detail.
- Create tournament form.

## 7. Motion con intencion

El proyecto tiene Motion/Framer Motion, pero debe usarse de manera selectiva.

Patrones recomendados:

- Entrada de pagina: `opacity + y`.
- Entrada de secciones: stagger sutil.
- Hover de cards importantes: escala leve o elevacion leve.
- Estados activos: borde/acento animado.
- Cambio de tabs: transicion corta.
- Selector de participante: cambio de avatar/nombre con fade o slide controlado.

Evitar:

- Animaciones constantes sin funcion.
- Glows pulsando en demasiados lugares.
- Movimiento decorativo en cada card.
- Transiciones lentas que hagan sentir pesada la UI.

## 8. Perfil como prioridad alta

La pagina de perfil debe alinearse con la identidad de la app. Actualmente se siente diferente y mas generica que el resto.

Direccion propuesta:

- Convertirla en un `player hub`.
- Header tipo perfil competitivo.
- Avatar/rango/stats como bloque principal.
- Menos cards anidadas.
- Secciones con lineas tecnicas y paneles duros.
- Acciones con `polygon-shape` y/o `animated-button` segun importancia.
- Reducir radial gradients y decoracion excesiva.
- Mantener jerarquia clara y simetria con las demas paginas.

Objetivo: que la pagina parezca parte de una app de torneos gaming, no un dashboard corporativo.

## 9. Orden de implementacion recomendado

1. Refactorizar `globals.css`:
   - limpiar `animated-button`
   - mejorar `polygon-shape`
   - ajustar utilidades de glow si hace falta

2. Ajustar componentes base propios:
   - `Button`
   - `Badge`
   - tabs/filtros usados por modulos

3. Limpiar paginas de torneos:
   - overview
   - tournament card
   - detalle de torneo
   - CTAs principales

4. Limpiar wallet:
   - bajar radios
   - reducir cards internas
   - aplicar polygon en tabs/acciones principales

5. Rediseñar profile:
   - estructura tipo player hub
   - menos nesting
   - mejor integracion visual con la app

6. Revisar clans, auth y arena:
   - quitar radios grandes donde no tengan sentido
   - reducir brillo innecesario
   - alinear CTAs e interacciones

7. Pasada final:
   - buscar `rounded-xl`, `rounded-2xl`, `rounded-3xl`
   - buscar `radial-gradient`
   - buscar `shadow-neon`
   - validar que los cambios no afecten usabilidad

## 10. Criterios de aceptacion

- Menos bordes redondeados visibles en la experiencia principal.
- Botones, links y tabs importantes con lenguaje mas angular.
- Menos glow permanente y menos spray de gradientes.
- Menos cards dentro de cards.
- Perfil integrado visualmente con el resto de la app.
- Neon usado como acento estrategico, no como decoracion constante.
- Interacciones mas gaming sin volverse infantiles ni ruidosas.
- UI mas cercana a esports, versus screen, roster UI y player hub.

