// Triggered by pg_cron every 5 min. Picks 'scheduled' publications whose time
// has arrived and dispatches them via publish-to-social.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (p: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const nowIso = new Date().toISOString();
    const dueRes = await fetch(
      `${supabaseUrl}/rest/v1/social_publications?status=eq.scheduled&scheduled_at=lte.${nowIso}&select=*&limit=20`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const due: any[] = await dueRes.json();

    if (!due?.length) return respond({ ok: true, processed: 0 });

    const results: any[] = [];
    for (const pub of due) {
      // Mark as publishing immediately to prevent double-trigger
      await fetch(`${supabaseUrl}/rest/v1/social_publications?id=eq.${pub.id}`, {
        method: "PATCH",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "publishing" }),
      });

      try {
        // Re-use publish-to-social flow but skip schedule param so it publishes now
        const r = await fetch(`${supabaseUrl}/functions/v1/publish-to-social`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            clip_id: pub.clip_id,
            social_connection_id: pub.social_connection_id,
            caption: pub.caption,
            _from_scheduler: true,
            _existing_publication_id: pub.id,
          }),
        });
        const data = await r.json();
        results.push({ id: pub.id, ok: data.ok, error: data.error });
      } catch (e) {
        results.push({ id: pub.id, ok: false, error: String(e) });
        await fetch(`${supabaseUrl}/rest/v1/social_publications?id=eq.${pub.id}`, {
          method: "PATCH",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed" }),
        });
      }
    }

    return respond({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error("process-scheduled-publications error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
