// Crea una direct upload URL de Mux para que el admin del portal suba un
// video sin proxy del server. Mux transcodea automáticamente y dispara el
// webhook video.asset.ready cuando termina.
//
// Auth model (mismo que el storage RLS legacy):
//   - global_admin o admin role → puede subir a cualquier portal.
//   - dueño del portal (ibs.created_by = auth.uid()) → solo su portal.
//
// Flujo:
//   1. Validar JWT + permisos sobre el portal de la lesson.
//   2. POST /video/v1/uploads a Mux con playback_policy=signed (URLs firmadas).
//   3. Persistir mux_upload_id en la lesson + status=preparing.
//   4. Devolver la upload URL al frontend para PUT directo del MP4.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, muxRequest } from "../_shared/mux-helpers.js";

interface MuxUploadResponse {
  data: {
    id: string;
    url: string;
    timeout: number;
    status: string;
    new_asset_settings: Record<string, unknown>;
    cors_origin: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Auth — JWT del admin de Lovable (auth.users).
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return err("Sin token");
    const { data: { user: authUser } } = await supa.auth.getUser(token);
    if (!authUser) return err("No autenticado");

    // 2) Body — lesson_id.
    const { lesson_id } = await req.json();
    if (!lesson_id) return err("lesson_id requerido");

    // 3) Resolver la cadena lesson → module → course → portal.
    const { data: lesson } = await supa
      .from("academy_lessons")
      .select("id, title, module_id")
      .eq("id", lesson_id)
      .maybeSingle();
    if (!lesson) return err("Lección no encontrada");

    const { data: mod } = await supa
      .from("academy_modules")
      .select("id, course_id")
      .eq("id", lesson.module_id)
      .maybeSingle();
    if (!mod) return err("Módulo no encontrado");

    const { data: course } = await supa
      .from("academy_courses")
      .select("id, portal_id")
      .eq("id", mod.course_id)
      .maybeSingle();
    if (!course) return err("Curso no encontrado");

    // 4) Autorización. Tres caminos válidos:
    //   a) Usuario tiene rol admin o global_admin.
    //   b) Usuario es el creador del IB (legacy: ibs.created_by = user.id).
    //   c) Usuario es el OWNER del IB por email-match (ibs.email = user.email).
    //      Este es el caso del IB que accede via "Invitar Portal": auth.users
    //      tiene su email, pero ibs.created_by sigue siendo el admin que creó
    //      el IB en el wizard. Sin (c) un IB nunca podría administrar su
    //      propio portal — gap heredado de la storage RLS policy legacy.
    const isAdmin = await isUserAdmin(supa, authUser.id);
    const isPortalOwner = isAdmin
      ? true
      : await isUserPortalOwner(
          supa,
          authUser.id,
          authUser.email ?? null,
          course.portal_id,
        );
    if (!isAdmin && !isPortalOwner) {
      return err("Sin permisos sobre este portal", {}, 403);
    }

    // 5) Crear direct upload en Mux.
    // playback_policy: ["signed"] → el playback solo funciona con JWT firmado
    //   por nuestra signing key. Sin JWT → 403.
    // mp4_support: "standard" → Mux genera además un MP4 progresivo (útil para
    //   descarga offline si el cliente quiere; no afecta playback HLS).
    // input.normalize_audio → corrige volumen entre lecciones grabadas con
    //   distintos niveles.
    const muxRes = await muxRequest<MuxUploadResponse>(
      "/video/v1/uploads",
      "POST",
      {
        new_asset_settings: {
          playback_policy: ["signed"],
          mp4_support: "standard",
          video_quality: "plus",
          normalize_audio: true,
          passthrough: JSON.stringify({
            lesson_id: lesson.id,
            portal_id: course.portal_id,
          }),
        },
        cors_origin: "*", // El admin sube desde el browser; cualquier origen del frontend.
        timeout: 3600,    // 1 hora para completar el upload.
      },
    );

    if (!muxRes.ok || !muxRes.data?.data) {
      console.error("Mux create upload failed", muxRes.status, muxRes.data);
      return err("No se pudo crear el upload en Mux", { mux_status: muxRes.status });
    }

    const upload = muxRes.data.data;

    // 6) Persistir el upload_id + marcar status=preparing.
    // El asset_id aún no existe; lo asignamos cuando llegue el webhook
    // video.upload.asset_created (lo busca por mux_upload_id).
    const { error: updErr } = await supa
      .from("academy_lessons")
      .update({
        mux_upload_id: upload.id,
        mux_status: "preparing",
        mux_error_message: null,
      })
      .eq("id", lesson.id);

    if (updErr) {
      console.error("Failed to persist mux_upload_id", updErr);
      // Best-effort: el upload de Mux ya existe; el webhook eventualmente lo
      // asociará por el passthrough. No abortamos.
    }

    return ok({
      upload_id: upload.id,
      upload_url: upload.url,
      timeout_seconds: upload.timeout,
    });
  } catch (e) {
    console.error("academy-mux-create-upload error", e);
    return err((e as Error).message || "Error interno");
  }
});


// ============================================================================
// Authorization helpers (mismo modelo que la storage policy legacy)
// ============================================================================
async function isUserAdmin(supa: any, userId: string): Promise<boolean> {
  const { data } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "global_admin"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

// Un user es "owner" del portal si:
//   - es el creador del IB linkeado al portal (ibs.created_by = user.id), o
//   - el email del IB coincide con el email del user logueado (caso del IB
//     que accede via flujo de invitación).
// La doble vía existe porque ibs.created_by se setea con el admin que
// completa el wizard, no con el IB mismo. Solo el email-match identifica
// correctamente al IB-owner cuando éste accede directamente al portal.
//
// Implementación: 2 queries separadas (portal → ib_id, después ibs por id)
// + check en JS. Evitamos los filtros sobre tablas joineadas en PostgREST
// (`.eq("ibs.created_by", ...)` y `.ilike("ibs.email", ...)`) porque tienen
// quirks de evaluación y no siempre filtran como uno esperaría.
async function isUserPortalOwner(
  supa: any,
  userId: string,
  userEmail: string | null,
  portalId: string,
): Promise<boolean> {
  // 1) Resolver portal → ib_id
  const { data: portal, error: portalErr } = await supa
    .from("partner_portals")
    .select("ib_id")
    .eq("id", portalId)
    .maybeSingle();
  if (portalErr) {
    console.error("isUserPortalOwner: portal lookup failed", portalErr);
    return false;
  }
  if (!portal?.ib_id) {
    console.warn("isUserPortalOwner: portal sin ib_id", { portalId });
    return false;
  }

  // 2) Leer el IB y comparar created_by + correo_ib.
  // NOTA: la columna del email del IB es `correo_ib` (no `email`). El campo
  // `ibs.email` no existe — esto causaba que el match por email del v1/v2
  // anteriores fallara en silencio y devolviera 403.
  const { data: ib, error: ibErr } = await supa
    .from("ibs")
    .select("id, created_by, correo_ib")
    .eq("id", portal.ib_id)
    .maybeSingle();
  if (ibErr) {
    console.error("isUserPortalOwner: ib lookup failed", ibErr);
    return false;
  }
  if (!ib) {
    console.warn("isUserPortalOwner: ib no encontrado", { ib_id: portal.ib_id });
    return false;
  }

  // (a) Match por created_by — admin que completó el wizard del IB.
  if (ib.created_by === userId) return true;

  // (b) Match por correo_ib — IB-owner accediendo via flujo de invitación.
  const ibEmail = (ib.correo_ib || "").trim().toLowerCase();
  const userEmailNorm = (userEmail || "").trim().toLowerCase();
  if (ibEmail && userEmailNorm && ibEmail === userEmailNorm) return true;

  console.warn("isUserPortalOwner: no match", {
    user_id: userId,
    user_email: userEmailNorm,
    ib_created_by: ib.created_by,
    ib_correo: ibEmail,
  });
  return false;
}
