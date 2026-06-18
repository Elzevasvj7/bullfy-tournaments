import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { poll_id, voter_id, option } = await req.json();
    if (!poll_id || !voter_id || !option) {
      return new Response(JSON.stringify({ ok: false, error: "poll_id, voter_id y option son requeridos" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: poll, error: pollErr } = await sb
      .from("live_meeting_polls")
      .select("id, options, votes, closed_at")
      .eq("id", poll_id)
      .maybeSingle();

    if (pollErr || !poll) {
      return new Response(JSON.stringify({ ok: false, error: "Encuesta no encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (poll.closed_at) {
      return new Response(JSON.stringify({ ok: false, error: "Encuesta cerrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const opts: string[] = Array.isArray(poll.options) ? poll.options : [];
    if (!opts.includes(option)) {
      return new Response(JSON.stringify({ ok: false, error: "Opción inválida" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newVotes = { ...(poll.votes || {}), [String(voter_id)]: option };
    const { error: upErr } = await sb
      .from("live_meeting_polls")
      .update({ votes: newVotes })
      .eq("id", poll_id);

    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || "error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
