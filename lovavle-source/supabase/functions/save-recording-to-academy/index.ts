import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const COURSE_TITLE = "Grabaciones en Vivo";
const MODULE_TITLE = "En Vivos";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recording_id } = await req.json();
    if (!recording_id || typeof recording_id !== "string") {
      return jsonResp({ error: "recording_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Load recording + room
    const { data: rec, error: recErr } = await admin
      .from("live_recordings")
      .select("id, room_id, file_path, file_size, duration_seconds, recorded_by, academy_lesson_id, created_at")
      .eq("id", recording_id)
      .maybeSingle();

    if (recErr || !rec) {
      return jsonResp({ error: "recording not found" }, 404);
    }

    if (rec.academy_lesson_id) {
      return jsonResp({ ok: true, skipped: "already_published", lesson_id: rec.academy_lesson_id });
    }

    const { data: room, error: roomErr } = await admin
      .from("live_rooms")
      .select("id, host_id, title")
      .eq("id", rec.room_id)
      .maybeSingle();

    if (roomErr || !room) {
      return jsonResp({ error: "room not found" }, 404);
    }

    // 2. Find portal owned by host (via ibs.created_by → partner_portals.ib_id)
    const { data: ib } = await admin
      .from("ibs")
      .select("id")
      .eq("created_by", room.host_id)
      .limit(1)
      .maybeSingle();

    if (!ib) {
      return jsonResp({ ok: true, skipped: "host_has_no_ib" });
    }

    const { data: portal } = await admin
      .from("partner_portals")
      .select("id, recording_to_class_enabled, status")
      .eq("ib_id", ib.id)
      .eq("status", "active")
      .maybeSingle();

    if (!portal) {
      return jsonResp({ ok: true, skipped: "no_active_portal" });
    }

    if (!(portal as any).recording_to_class_enabled) {
      return jsonResp({ ok: true, skipped: "feature_disabled" });
    }

    // 3. Ensure course "Grabaciones en Vivo" (per portal)
    let courseId: string | null = null;
    {
      const { data: existing } = await admin
        .from("academy_courses")
        .select("id")
        .eq("portal_id", portal.id)
        .eq("title", COURSE_TITLE)
        .maybeSingle();

      if (existing) {
        courseId = existing.id;
      } else {
        const { data: created, error: cErr } = await admin
          .from("academy_courses")
          .insert({
            portal_id: portal.id,
            title: COURSE_TITLE,
            description: "Clases grabadas de las sesiones en vivo del portal.",
            is_free: true,
            price_usd: 0,
            status: "published",
            created_by: room.host_id,
          })
          .select("id")
          .single();
        if (cErr) return jsonResp({ error: "course_create_failed: " + cErr.message }, 500);
        courseId = created.id;
      }
    }

    // 4. Ensure module "En Vivos"
    let moduleId: string | null = null;
    {
      const { data: existingMod } = await admin
        .from("academy_modules")
        .select("id")
        .eq("course_id", courseId!)
        .eq("title", MODULE_TITLE)
        .maybeSingle();

      if (existingMod) {
        moduleId = existingMod.id;
      } else {
        const { data: createdMod, error: mErr } = await admin
          .from("academy_modules")
          .insert({
            course_id: courseId,
            title: MODULE_TITLE,
            display_order: 1,
          })
          .select("id")
          .single();
        if (mErr) return jsonResp({ error: "module_create_failed: " + mErr.message }, 500);
        moduleId = createdMod.id;
      }
    }

    // 5. Copy file from live-recordings → academy-videos (under portal_id/...)
    const sourcePath = rec.file_path as string;
    const fileName = sourcePath.split("/").pop() || `${Date.now()}.webm`;
    const destPath = `${portal.id}/grabaciones-en-vivo/${fileName}`;

    // Download source
    const { data: blob, error: dlErr } = await admin.storage
      .from("live-recordings")
      .download(sourcePath);
    if (dlErr || !blob) {
      return jsonResp({ error: "download_failed: " + (dlErr?.message || "no blob") }, 500);
    }

    // Upload to academy bucket
    const { error: upErr } = await admin.storage
      .from("academy-videos")
      .upload(destPath, blob, { contentType: "video/webm", upsert: true });
    if (upErr) {
      return jsonResp({ error: "upload_failed: " + upErr.message }, 500);
    }

    // 6. Get next display_order
    const { data: maxOrder } = await admin
      .from("academy_lessons")
      .select("display_order")
      .eq("module_id", moduleId!)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    const dateLabel = new Date(rec.created_at as string).toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const lessonTitle = `${room.title || "Live"} – ${dateLabel}`;

    // 7. Create lesson
    const { data: lesson, error: lErr } = await admin
      .from("academy_lessons")
      .insert({
        module_id: moduleId,
        title: lessonTitle,
        description: `Grabación del live realizado el ${dateLabel}.`,
        video_path: destPath,
        duration_seconds: rec.duration_seconds || 0,
        display_order: nextOrder,
      })
      .select("id")
      .single();

    if (lErr) return jsonResp({ error: "lesson_create_failed: " + lErr.message }, 500);

    // 8. Link recording → lesson
    await admin
      .from("live_recordings")
      .update({ academy_lesson_id: lesson.id })
      .eq("id", recording_id);

    return jsonResp({
      ok: true,
      lesson_id: lesson.id,
      course_id: courseId,
      module_id: moduleId,
      portal_id: portal.id,
    });
  } catch (err: any) {
    return jsonResp({ error: err?.message || String(err) }, 500);
  }
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
