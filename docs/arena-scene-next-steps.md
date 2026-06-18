# Arena Scene Next Steps

Notas para evolucionar la escena del torneo sin convertirla en un dashboard tradicional.

## Prioridad alta

1. Sistema de estados visuales del torneo
   - Lider: luz dorada o azul intensa sobre su zona/podio.
   - Top 3: acentos diferenciados por posicion.
   - En riesgo: pulso naranja/rojo.
   - Eliminado: luz apagada, presencia visible pero minima.

2. Presets de camara
   - Panoramica: vista general de arena.
   - Podio: primer plano tipo Formula 1.
   - Mercado: foco en pantalla o centro de datos.
   - Top 3: barrido corto entre finalistas.
   - Campeon: camara lenta hacia el ganador.

3. Transiciones cinematograficas
   - Interpolar posicion y target de camara.
   - Evitar saltos bruscos entre presets.
   - Usar easing lento para momentos de tension o final.

4. Iluminacion dinamica
   - Spotlights moviles sobre podio/finalistas.
   - Luz ambiental azul institucional.
   - Destellos suaves cuando cambia el ranking.
   - Intensidad reducida cuando el torneo esta pausado o finalizado.

## Prioridad media

5. Overlays anclados a la escena
   - Nombre del trader.
   - Posicion.
   - PnL.
   - Estado competitivo.
   - Deben sentirse como broadcast overlays, no tarjetas administrativas.

6. Modo evento en vivo
   - Nuevo lider.
   - Cambio de posicion.
   - Eliminacion.
   - Drawdown critico.
   - La camara puede enfocar brevemente el evento y volver a panoramica.

7. Animacion ambiental
   - Orbitacion lenta de camara.
   - Luces respirando.
   - Pantallas con brillo sutil.
   - Particulas o flujos de datos discretos.

## Cuando haya mas assets

8. Posiciones reales de participantes
   - Mapear 20 estaciones fijas dentro del GLB.
   - Cada trader debe vivir en una posicion persistente.

9. Secuencia de eliminacion
   - La estacion pierde energia lentamente.
   - El badge se apaga.
   - La estacion queda como registro historico del torneo.

10. Final cinematografica
   - Oscurecer el resto de la arena.
   - Spotlight fuerte al campeon.
   - Camara baja frontal.
   - Luz dorada, blanca o azul electrica.
   - Ranking reducido al top 3.

## Recomendacion de siguiente fase

Antes de agregar mas UI, conviene construir dos sistemas base:

- Sistema de camaras: presets, transiciones e intenciones narrativas.
- Sistema de estados visuales: ranking, riesgo, eliminacion y ganador.

Con eso el GLB empieza a comportarse como una arena viva y queda listo para recibir mas assets.
