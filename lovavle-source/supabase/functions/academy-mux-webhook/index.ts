// Webhook receiver para eventos de Mux Video.
//
// Eventos manejados:
//   video.upload.asset_created → Mux creó el asset desde el upload. Asignamos
//                                mux_asset_id a la lesson o event (lookup por upload_id).
//   video.asset.ready          → Asset transcodeado, listo para reproducir.
//                                Persistimos mux_playback_id + duration + status=ready.
//   video.asset.errored        → Mux falló al procesar. Marcamos status=errored.
//   video.upload.errored       → El upload mismo falló (timeout, archivo corrupto).
//
// Tablas objetivo:
//   - academy_lessons  → videos de cursos, playback_policy=signed (JWT requerido).
//   - portal_events    → videos de promoción de eventos, playback_policy=public.
// El passthrough JSON diferencia los dos casos: { lesson_id } vs { event_id }.
//
// Seguridad: HMAC-SHA256 sobre `<timestamp>.<rawBody>` con MUX_WEBHOOK_SECRET.
// Tolerancia 5 min. Sin firma válida → 400 (fail-closed).
//
// Idempotencia: todos los UPDATEs son por id + condicional en mux_status para
// no sobrescribir un status terminal con uno intermedio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, verifyMuxWebhook } from "../_shared/mux-helpers.js";

interface MuxWebhookEvent {
  type: string;
  id: string;
  created_at: string;
  data: {
    id: string;
    status?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    errors?: { type?: string; messages?: string[] };
    upload_id?: string;
    asset_id?: string;
    passthrough?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = Deno.env.get("MUX_WEBHOOK_SECRET");
    if (!secret) {
      console.error("MUX_WEBHOOK_SECRET no configurado");
      return err("Webhook secret not configured", {}, 400);
    }

    const rawBody = await req.text();
    const sigHeader = req.headers.get("mux-signature");

    const valid = await verifyMuxWebhook(rawBody, sigHeader, secret);
    if (!valid) {
      console.warn("Mux webhook signature inválida", { sigHeader });
      return err("Invalid signature", {}, 400);
    }

    const event = JSON.parse(rawBody) as MuxWebhookEvent;
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (event.type) {
      case "video.upload.asset_created":
        await handleAssetCreated(supa, event);
        break;
      case "video.asset.ready":
        await handleAssetReady(supa, event);
        break;
      case "video.asset.errored":
        await handleAssetErrored(supa, event);
        break;
      case "video.upload.errored":
        await handleUploadErrored(supa, event);
        break;
      default:
        break;
    }

    return ok({ received: true, type: event.type });
  } catch (e) {
    console.error("academy-mux-webhook error", e);
    return ok({ received: true, error: (e as Error).message });
  }
});


// ----------------------------------------------------------------------------
// Passthrough helper
// ----------------------------------------------------------------------------
function parsePassthrough(passthrough?: string): Record<string, string> {
  try { return JSON.parse(passthrough || "{}"); } catch { return {}; }
}


// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

async function handleAssetCreated(supa: any, event: MuxWebhookEvent) {
  const uploadId = event.data.id;
  const assetId = event.data.asset_id;
  if (!uploadId || !assetId) {
    console.warn("video.upload.asset_created sin upload_id o asset_id", event.data);
    return;
  }

  // Try academy_lessons first
  const { error: lessonErr, data: lessonData } = await supa
    .from("academy_lessons")
    .update({ mux_asset_id: assetId })
    .eq("mux_upload_id", uploadId)
    .is("mux_asset_id", null)
    .select("id");

  if (lessonErr) console.error("asset_created lesson update failed", lessonErr);
  if (lessonData?.length) return;

  // Try portal_events
  const { error: eventErr, data: eventData } = await supa
    .from("portal_events")
    .update({ mux_asset_id: assetId })
    .eq("mux_upload_id", uploadId)
    .is("mux_asset_id", null)
    .select("id");

  if (eventErr) console.error("asset_created event update failed", eventErr);
  if (!eventData?.length) {
    console.warn("asset_created: ningún registro con upload_id=" + uploadId);
  }
}

async function handleAssetReady(supa: any, event: MuxWebhookEvent) {
  const assetId = event.data.id;
  const playbackIds = event.data.playback_ids || [];

  // --- academy_lessons: playback_policy=signed ---
  const signedPlayback = playbackIds.find((p) => p.policy === "signed");
  if (signedPlayback) {
    const { data } = await supa
      .from("academy_lessons")
      .update({
        mux_playback_id: signedPlayback.id,
        mux_status: "ready",
        mux_duration_seconds: event.data.duration ?? null,
        mux_error_message: null,
        duration_seconds: event.data.duration ? Math.round(event.data.duration) : undefined,
      })
      .eq("mux_asset_id", assetId)
      .neq("mux_status", "ready")
      .select("id");

    if (data?.length) return;

    // Fallback: buscar por upload_id si el asset_created llegó out-of-order
    if (event.data.upload_id) {
      const { data: data2 } = await supa
        .from("academy_lessons")
        .update({
          mux_asset_id: assetId,
          mux_playback_id: signedPlayback.id,
          mux_status: "ready",
          mux_duration_seconds: event.data.duration ?? null,
          duration_seconds: event.data.duration ? Math.round(event.data.duration) : undefined,
        })
        .eq("mux_upload_id", event.data.upload_id)
        .select("id");
      if (data2?.length) return;
    }
  }

  // --- portal_events: playback_policy=public ---
  const publicPlayback = playbackIds.find((p) => p.policy === "public");
  if (publicPlayback) {
    const { data } = await supa
      .from("portal_events")
      .update({
        mux_playback_id: publicPlayback.id,
        mux_status: "ready",
        mux_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("mux_asset_id", assetId)
      .neq("mux_status", "ready")
      .select("id");

    if (data?.length) return;

    if (event.data.upload_id) {
      await supa
        .from("portal_events")
        .update({
          mux_asset_id: assetId,
          mux_playback_id: publicPlayback.id,
          mux_status: "ready",
          mux_error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("mux_upload_id", event.data.upload_id);
    }
    return;
  }

  if (!signedPlayback && !publicPlayback) {
    console.warn("video.asset.ready sin playback_id conocido", event.data);
  }
}

async function handleAssetErrored(supa: any, event: MuxWebhookEvent) {
  const assetId = event.data.id;
  const msg = event.data.errors?.messages?.join("; ") || "Mux asset errored";

  await supa
    .from("academy_lessons")
    .update({ mux_status: "errored", mux_error_message: msg })
    .eq("mux_asset_id", assetId);

  await supa
    .from("portal_events")
    .update({ mux_status: "errored", mux_error_message: msg, updated_at: new Date().toISOString() })
    .eq("mux_asset_id", assetId);
}

async function handleUploadErrored(supa: any, event: MuxWebhookEvent) {
  const uploadId = event.data.id;
  const msg = "Upload falló en Mux (timeout o archivo inválido)";

  await supa
    .from("academy_lessons")
    .update({ mux_status: "errored", mux_error_message: msg })
    .eq("mux_upload_id", uploadId);

  await supa
    .from("portal_events")
    .update({ mux_status: "errored", mux_error_message: msg, updated_at: new Date().toISOString() })
    .eq("mux_upload_id", uploadId);
}
