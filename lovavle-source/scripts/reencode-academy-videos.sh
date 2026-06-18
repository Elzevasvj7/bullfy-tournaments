#!/usr/bin/env bash
# ============================================================================
# Re-encode Academy videos for fast streaming
# ----------------------------------------------------------------------------
# Qué hace:
#   1. Descarga cada video del bucket `academy-videos` (Supabase Storage).
#   2. Re-encodea a H.264 + AAC con `+faststart` (moov atom al inicio → el
#      navegador empieza a reproducir sin descargar el archivo completo).
#   3. Genera 2 variantes: 720p (calidad) y 480p (móvil/conexiones lentas).
#   4. Sube las variantes de vuelta al bucket bajo:
#        <original_path>            → reemplaza con 720p re-encodeado
#        <original_path>.480p.mp4   → variante móvil
#   5. Valida con ffprobe que cada salida tenga `moov` al inicio.
#
# Requisitos:
#   - ffmpeg, ffprobe, curl, jq instalados.
#   - Variables de entorno:
#       SUPABASE_URL                (ej. https://dpfqhwcjyecpnvtchudo.supabase.co)
#       SUPABASE_SERVICE_ROLE_KEY   (service role, NO el anon)
#
# Uso:
#   chmod +x scripts/reencode-academy-videos.sh
#   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/reencode-academy-videos.sh
#
# Notas operativas:
#   - Hacer un BACKUP del bucket antes (descargar todo a local).
#   - Correr en horario bajo (los usuarios con video en pausa pueden fallar al
#     reanudar por mismatch de Range request mientras se sobrescribe).
#   - Tiempo estimado: ~3-5 min por video × 23 videos ≈ 1.5-2 horas.
#   - Si un video ya tiene faststart, el script lo detecta y lo salta.
# ============================================================================

set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL no está definido}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY no está definido}"

BUCKET="academy-videos"
WORKDIR="$(mktemp -d)"
echo "Workdir: $WORKDIR"

API="${SUPABASE_URL}/storage/v1"
AUTH=(-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")

# ---------- 1. Listar todos los archivos del bucket (recursivo) ----------
list_files() {
  local prefix="${1:-}"
  curl -s "${AUTH[@]}" -H "Content-Type: application/json" \
    -X POST "${API}/object/list/${BUCKET}" \
    -d "{\"prefix\":\"${prefix}\",\"limit\":1000,\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}" \
    | jq -r '.[] | select(.id != null) | .name'
}

echo "Listando videos en bucket ${BUCKET}..."
mapfile -t FILES < <(list_files "" | grep -Ei '\.(mp4|mov|webm|mkv)$' | grep -v '\.480p\.mp4$' || true)
echo "Encontrados: ${#FILES[@]} videos"

# ---------- 2. Procesar cada video ----------
i=0
for path in "${FILES[@]}"; do
  i=$((i+1))
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "[$i/${#FILES[@]}] $path"
  echo "═══════════════════════════════════════════════════════════════"

  src="${WORKDIR}/src_${i}.mp4"
  out720="${WORKDIR}/out720_${i}.mp4"
  out480="${WORKDIR}/out480_${i}.mp4"

  # Descargar
  echo "→ Descargando..."
  curl -sSL "${AUTH[@]}" "${API}/object/${BUCKET}/${path}" -o "$src"

  # ¿Ya tiene faststart? (moov antes que mdat)
  if ffprobe -v error -read_intervals "%+#1" -show_entries format=tags "$src" >/dev/null 2>&1; then
    moov_pos=$(ffprobe -v trace "$src" 2>&1 | grep -m1 -oE 'type:.moov' | head -1 || true)
    # Heurística: si el moov atom está dentro de los primeros 1MB, está al inicio.
    head -c 1048576 "$src" | grep -q "moov" && already_faststart=1 || already_faststart=0
  else
    already_faststart=0
  fi

  if [ "$already_faststart" = "1" ]; then
    echo "✓ Ya tiene faststart, saltando re-encode de 720p (solo genera 480p)."
    cp "$src" "$out720"
  else
    echo "→ Re-encodeando 720p (CRF 23, faststart)..."
    ffmpeg -y -i "$src" \
      -vf "scale='min(1280,iw)':'-2'" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "$out720" -loglevel error
  fi

  echo "→ Generando variante 480p (CRF 26, faststart)..."
  ffmpeg -y -i "$src" \
    -vf "scale='min(854,iw)':'-2'" \
    -c:v libx264 -preset medium -crf 26 \
    -c:a aac -b:a 96k \
    -movflags +faststart \
    "$out480" -loglevel error

  # Validación: ¿moov al inicio?
  for f in "$out720" "$out480"; do
    if ! head -c 1048576 "$f" | grep -q "moov"; then
      echo "✗ ERROR: $f no tiene moov al inicio. Abortando."
      exit 1
    fi
  done
  echo "✓ Validación faststart OK"

  # Subir (upsert) — 720p reemplaza el original
  echo "→ Subiendo 720p → ${path}"
  curl -sS "${AUTH[@]}" -X PUT \
    -H "Content-Type: video/mp4" -H "x-upsert: true" \
    --data-binary "@${out720}" \
    "${API}/object/${BUCKET}/${path}" >/dev/null

  path480="${path%.*}.480p.mp4"
  echo "→ Subiendo 480p → ${path480}"
  curl -sS "${AUTH[@]}" -X PUT \
    -H "Content-Type: video/mp4" -H "x-upsert: true" \
    --data-binary "@${out480}" \
    "${API}/object/${BUCKET}/${path480}" >/dev/null

  # Limpiar
  rm -f "$src" "$out720" "$out480"
  echo "✓ Completado"
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✓ Listo. ${#FILES[@]} videos procesados."
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Siguiente paso opcional (frontend):"
echo "  Implementar selector 480p/720p en AcademyClient.tsx basado en"
echo "  window.innerWidth < 768 o navigator.connection.effectiveType."

rm -rf "$WORKDIR"
