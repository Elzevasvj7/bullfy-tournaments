// Polling público — verifica si un link_token fue consumido (lead vinculado)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ ok: false, error: "missing token" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from("telegram_link_tokens")
      .select("token, lead_id, consumed_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ ok: false, linked: false, error: "token not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const linked = !!data.consumed_at;
    let telegram_username: string | null = null;
    if (linked && data.lead_id) {
      const { data: lead } = await admin
        .from("stream_leads")
        .select("telegram_username")
        .eq("id", data.lead_id)
        .maybeSingle();
      telegram_username = lead?.telegram_username ?? null;
    }

    return new Response(JSON.stringify({ ok: true, linked, telegram_username, lead_id: data.lead_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
