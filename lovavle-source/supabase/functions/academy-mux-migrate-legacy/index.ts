// Migra una lección legacy (con video_path en Supabase Storage) a Mux.
// A diferencia de academy-mux-create-upload, no hacemos upload desde el
// browser: le pasamos a Mux la signed URL del bucket y Mux pullea el archivo
// y lo transcodea por su cuenta. Cero ancho de banda de nuestro server.
//
// Flujo:
//   1. Validar caller (admin / portal owner del IB de la lesson).
//   2. Resolver lesson → video_path. Si no tiene video legacy, abort.
//   3. Generar signed URL del bucket academy-videos (TTL 1h — Mux pullea en
//      segundos, suficiente buffer).
//   4. POST /video/v1/assets a Mux con input.url = signed_url.
//   5. Persistir mux_asset_id en la lesson + status=preparing.
//   6. El webhook video.asset.ready se encarga del resto (playback_id,
//      duration). El video_path legacy queda intacto como backup hasta que
//      el admin decida limpiarlo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, muxRequest } from "../_shared/mux-helpers.js";

interface MuxAssetResponse {
  data: {
    id: string;
    status: string;
    playback_ids?: Array<{ id: string; policy: string }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return err("Sin token");
    const { data: { user: authUser } } = await supa.auth.getUser(token);
    if (!authUser) return err("No autenticado");

    // 2) Body
    const { lesson_id } = await req.json();
    if (!lesson_id) return err("lesson_id requerido");

    // 3) Resolver lesson → module → course → portal
    const { data: lesson } = await supa
      .from("academy_lessons")
      .select("id, title, video_path, mux_status, mux_asset_id, module_id")
      .eq("id", lesson_id)
      .maybeSingle();
    if (!lesson) return err("Lección no encontrada");
    if (!lesson.video_path) {
      return err("Esta lección no tiene video legacy para migrar");
    }
    if (lesson.mux_status === "ready" || lesson.mux_status === "preparing") {
      return err("La lección ya tiene un video en Mux", { mux_status: lesson.mux_status });
    }

    const { data: mod } = await supa
      .from("academy_modules").select("id, course_id").eq("id", lesson.module_id).maybeSingle();
    if (!mod) return err("Módulo no encontrado");

    const { data: course } = await supa
      .from("academy_courses").select("id, portal_id").eq("id", mod.course_id).maybeSingle();
    if (!course) return err("Curso no encontrado");

    // 4) Autorización (mismo modelo que las otras EFs de academy-mux)
    const isAdmin = await isUserAdmin(supa, authUser.id);
    const isOwner = isAdmin
      ? true
      : await isUserPortalOwner(supa, authUser.id, authUser.email ?? null, course.portal_id);
    if (!isAdmin && !isOwner) return err("Sin permisos sobre este portal", {}, 403);

    // 5) Generar signed URL del bucket. TTL generoso (1h) por si el pull de
    // Mux entra en cola; en la práctica Mux empieza el pull en segundos.
    const { data: signed, error: signErr } = await supa.storage
      .from("academy-videos")
      .createSignedUrl(lesson.video_path, 3600);
    if (signErr || !signed?.signedUrl) {
      console.error("createSignedUrl failed", signErr, lesson.video_path);
      return err("No se pudo generar URL firmada del bucket: " + (signErr?.message || "desconocido"));
    }

    // 6) Crear asset en Mux pulleando desde la URL.
    // Misma config que academy-mux-create-upload para consistencia:
    //   playback_policy: signed → requiere JWT al reproducir.
    //   mp4_support: standard → genera MP4 progresivo además del HLS.
    //   video_quality: plus → renditions hasta 1080p si el source lo permite.
    //   normalize_audio: nivela volumen entre lecciones.
    //   passthrough: lesson_id para idempotencia y referencia en webhook.
    const muxRes = await muxRequest<MuxAssetResponse>(
      "/video/v1/assets",
      "POST",
      {
        input: [{ url: signed.signedUrl }],
        playback_policy: ["signed"],
        mp4_support: "standard",
        video_quality: "plus",
        normalize_audio: true,
        passthrough: JSON.stringify({
          lesson_id: lesson.id,
          portal_id: course.portal_id,
          source: "legacy_migration",
        }),
      },
    );

    if (!muxRes.ok || !muxRes.data?.data) {
      console.error("Mux asset create failed", muxRes.status, muxRes.data);
      return err("No se pudo crear el asset en Mux", { mux_status: muxRes.status, mux_data: muxRes.data });
    }

    const asset = muxRes.data.data;

    // 7) Persistir mux_asset_id + status=preparing.
    // NOTA: NO borramos video_path. Queda como backup hasta que confirmemos
    // que el flujo Mux funciona end-to-end para esta lesson. El frontend
    // siempre prefiere mux_playback_id si está presente; el legacy queda
    // como fallback inerte.
    const { error: updErr } = await supa
      .from("academy_lessons")
      .update({
        mux_asset_id: asset.id,
        mux_status: "preparing",
        mux_error_message: null,
      })
      .eq("id", lesson.id);

    if (updErr) {
      console.error("Failed to persist mux_asset_id post-Mux call", updErr);
      // El asset ya existe en Mux; el webhook eventualmente lo asociará via
      // passthrough (lesson_id). No abortamos.
    }

    return ok({
      lesson_id: lesson.id,
      mux_asset_id: asset.id,
      status: "preparing",
    });
  } catch (e) {
    console.error("academy-mux-migrate-legacy error", e);
    return err((e as Error).message || "Error interno");
  }
});


// ============================================================================
// Authorization helpers (replicados de academy-mux-create-upload y
// academy-mux-signed-token — mantener sincronizados, si el modelo cambia hay
// que actualizar los 3)
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

async function isUserPortalOwner(
  supa: any,
  userId: string,
  userEmail: string | null,
  portalId: string,
): Promise<boolean> {
  const { data: portal } = await supa
    .from("partner_portals").select("ib_id").eq("id", portalId).maybeSingle();
  if (!portal?.ib_id) return false;

  const { data: ib } = await supa
    .from("ibs").select("id, created_by, correo_ib").eq("id", portal.ib_id).maybeSingle();
  if (!ib) return false;

  if (ib.created_by === userId) return true;
  const ibEmail = (ib.correo_ib || "").trim().toLowerCase();
  const userEmailNorm = (userEmail || "").trim().toLowerCase();
  if (ibEmail && userEmailNorm && ibEmail === userEmailNorm) return true;
  return false;
}
