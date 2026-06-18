// Crea una direct upload URL de Mux para que el admin del portal suba un
// video de promoción para un evento. Usa playback_policy=public (no requiere
// JWT firmado para reproducir — es contenido promocional público).
//
// Límites: el frontend valida tamaño (500MB). La duración NO se limita en la
// creación del upload (Mux no soporta ese parámetro en el body).
//
// Auth: mismo modelo que academy-mux-create-upload.
//   - global_admin o admin → puede operar sobre cualquier portal.
//   - dueño del portal (ibs.created_by = auth.uid() o correo_ib match) → su portal.

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

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return err("Sin token");
    const { data: { user: authUser } } = await supa.auth.getUser(token);
    if (!authUser) return err("No autenticado");

    const { event_id } = await req.json();
    if (!event_id) return err("event_id requerido");

    const { data: event } = await supa
      .from("portal_events")
      .select("id, title, portal_id")
      .eq("id", event_id)
      .maybeSingle();
    if (!event) return err("Evento no encontrado");

    const isAdmin = await isUserAdmin(supa, authUser.id);
    const isPortalOwner = isAdmin
      ? true
      : await isUserPortalOwner(supa, authUser.id, authUser.email ?? null, event.portal_id);
    if (!isAdmin && !isPortalOwner) return err("Sin permisos sobre este portal", {}, 403);

    // NOTA: `max_duration_seconds` NO es un campo válido del cuerpo de Mux
    // (ni a nivel raíz ni dentro de new_asset_settings). Mux valida el body de
    // forma estricta y rechaza parámetros desconocidos con HTTP 400, lo que
    // hacía que el upload fallara siempre con "No se pudo crear el upload en
    // Mux". El límite de duración del video promo se controla en el cliente
    // (tamaño) y, si hiciera falta, se valida post-ingest en el webhook
    // video.asset.ready (Mux reporta `duration`).
    const muxRes = await muxRequest<MuxUploadResponse>("/video/v1/uploads", "POST", {
      new_asset_settings: {
        playback_policy: ["public"],
        mp4_support: "standard",
        video_quality: "plus",
        normalize_audio: true,
        passthrough: JSON.stringify({ event_id: event.id, portal_id: event.portal_id }),
      },
      cors_origin: "*",
      timeout: 3600,
    });

    if (!muxRes.ok || !muxRes.data?.data) {
      console.error("Mux create upload failed", muxRes.status, muxRes.data);
      // Surface el motivo REAL de Mux para no quedar a ciegas. Mux devuelve los
      // errores como { error: { type, messages: [...] } }.
      const md = muxRes.data as any;
      const muxMsg = md?.error?.messages?.join("; ")
        || (typeof md?.error === "string" ? md.error : null)
        || muxRes.error
        || "sin detalle";
      return err(
        `Mux rechazó la creación del upload (HTTP ${muxRes.status}): ${muxMsg}`,
        { mux_status: muxRes.status },
      );
    }

    const upload = muxRes.data.data;

    await supa
      .from("portal_events")
      .update({
        mux_upload_id: upload.id,
        mux_status: "preparing",
        mux_error_message: null,
        media_type: "video",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    return ok({
      upload_id: upload.id,
      upload_url: upload.url,
      timeout_seconds: upload.timeout,
    });
  } catch (e) {
    console.error("portal-event-mux-upload error", e);
    return err((e as Error).message || "Error interno");
  }
});


// ============================================================================
// Authorization helpers — copiadas de academy-mux-create-upload
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
  const { data: portal, error: portalErr } = await supa
    .from("partner_portals")
    .select("ib_id")
    .eq("id", portalId)
    .maybeSingle();
  if (portalErr || !portal?.ib_id) return false;

  const { data: ib, error: ibErr } = await supa
    .from("ibs")
    .select("id, created_by, correo_ib")
    .eq("id", portal.ib_id)
    .maybeSingle();
  if (ibErr || !ib) return false;

  if (ib.created_by === userId) return true;
  const ibEmail = (ib.correo_ib || "").trim().toLowerCase();
  const userEmailNorm = (userEmail || "").trim().toLowerCase();
  if (ibEmail && userEmailNorm && ibEmail === userEmailNorm) return true;

  return false;
}
