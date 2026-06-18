// Genera highlights automáticos cuando un torneo finaliza.
// Crea 1 video general + 1 video por cada uno del top 3 vía Shotstack.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireServiceRole } from "../_shared/tournament-helpers.js";

const SHOTSTACK_API_URL = "https://api.shotstack.io/edit/v1";
const BRAND_BG = "#062B63";
const BRAND_ACCENT = "#146EF5";
const BRAND_WHITE = "#FFFFFF";

function buildGeneralTimeline(t: any, top3: any[]) {
  // Vertical 1080x1920, ~30s, 4 escenas
  const tracks: any[] = [];

  // Track 0: textos por escena
  const sceneClips: any[] = [];

  // Escena 1 (0-5s): Intro
  sceneClips.push({
    asset: { type: "html", html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:48px;opacity:.7;letter-spacing:4px;">BULLFY TOURNAMENT</div><div style="font-size:96px;font-weight:900;margin-top:24px;line-height:1.1;">${escapeHtml(t.name).slice(0, 40)}</div><div style="font-size:42px;margin-top:32px;color:${BRAND_ACCENT};">PREMIO $${Number(t.prize_pool_usd || 0).toLocaleString()}</div></div>`, width: 900, height: 1200 },
    start: 0,
    length: 5,
    transition: { in: "fade", out: "fade" },
  });

  // Escenas 2-4 (5-23s): Top 3 (6s c/u)
  const medals = ["🥇", "🥈", "🥉"];
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  top3.forEach((p, i) => {
    sceneClips.push({
      asset: {
        type: "html",
        html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:200px;">${medals[i]}</div><div style="font-size:64px;font-weight:900;color:${colors[i]};">PUESTO ${i + 1}</div><div style="font-size:72px;font-weight:700;margin-top:24px;">@${escapeHtml(p.username || "trader")}</div><div style="font-size:48px;margin-top:24px;color:${BRAND_ACCENT};">${Number(p.profit_pct).toFixed(2)}%</div><div style="font-size:42px;margin-top:16px;opacity:.85;">$${Number(p.prize_won_usd || 0).toLocaleString()} + ${p.points_won || 0} BP</div></div>`,
        width: 900,
        height: 1400,
      },
      start: 5 + i * 6,
      length: 6,
      transition: { in: "slideUp", out: "fade" },
    });
  });

  // Escena 5 (23-30s): Outro
  sceneClips.push({
    asset: {
      type: "html",
      html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:54px;opacity:.7;">${t.participants_count} participantes</div><div style="font-size:88px;font-weight:900;margin-top:32px;color:${BRAND_ACCENT};">¡SIGUE EL PRÓXIMO!</div><div style="font-size:42px;margin-top:48px;">bullfytech.online/tournament</div></div>`,
      width: 900,
      height: 1200,
    },
    start: 23,
    length: 7,
    transition: { in: "fade", out: "fade" },
  });

  tracks.push({ clips: sceneClips });

  // Background gradient
  tracks.push({
    clips: [{
      asset: { type: "html", html: `<div style="width:1080px;height:1920px;background:linear-gradient(180deg,${BRAND_BG} 0%,#021133 100%);"></div>`, width: 1080, height: 1920 },
      start: 0,
      length: 30,
    }],
  });

  return {
    timeline: { background: BRAND_BG, tracks },
    output: { format: "mp4", resolution: "hd", aspectRatio: "9:16", fps: 30 },
  };
}

function buildWinnerTimeline(t: any, p: any, rank: number) {
  const medals = ["🥇", "🥈", "🥉"];
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const m = medals[rank - 1] || "🏆";
  const c = colors[rank - 1] || BRAND_ACCENT;

  return {
    timeline: {
      background: BRAND_BG,
      tracks: [
        {
          clips: [
            {
              asset: { type: "html", html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:48px;opacity:.7;letter-spacing:4px;">BULLFY TOURNAMENT</div><div style="font-size:300px;margin-top:32px;">${m}</div><div style="font-size:80px;font-weight:900;color:${c};margin-top:16px;">PUESTO ${rank}</div></div>`, width: 1000, height: 1200 },
              start: 0,
              length: 4,
              transition: { in: "fade", out: "fade" },
            },
            {
              asset: { type: "html", html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:96px;font-weight:900;">@${escapeHtml(p.username || "trader")}</div><div style="font-size:54px;margin-top:32px;opacity:.8;">${escapeHtml(t.name).slice(0, 40)}</div><div style="font-size:120px;font-weight:900;color:${BRAND_ACCENT};margin-top:48px;">${Number(p.profit_pct).toFixed(2)}%</div><div style="font-size:48px;margin-top:24px;opacity:.85;">$${Number(p.prize_won_usd || 0).toLocaleString()} ganados</div><div style="font-size:42px;margin-top:16px;color:${BRAND_ACCENT};">+${p.points_won || 0} BULLFY POINTS</div></div>`, width: 1000, height: 1400 },
              start: 4,
              length: 8,
              transition: { in: "slideUp", out: "fade" },
            },
            {
              asset: { type: "html", html: `<div style="font-family:'Open Sans',sans-serif;color:${BRAND_WHITE};text-align:center;"><div style="font-size:64px;font-weight:700;">¿LISTO PARA EL PRÓXIMO?</div><div style="font-size:42px;margin-top:48px;color:${BRAND_ACCENT};">bullfytech.online/tournament</div></div>`, width: 1000, height: 1000 },
              start: 12,
              length: 4,
              transition: { in: "fade", out: "fade" },
            },
          ],
        },
        {
          clips: [{
            asset: { type: "html", html: `<div style="width:1080px;height:1920px;background:linear-gradient(180deg,${BRAND_BG} 0%,#021133 100%);"></div>`, width: 1080, height: 1920 },
            start: 0,
            length: 16,
          }],
        },
      ],
    },
    output: { format: "mp4", resolution: "hd", aspectRatio: "9:16", fps: 30 },
  };
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function submitShotstack(payload: any, apiKey: string, callbackUrl: string) {
  const body = { ...payload, callback: callbackUrl };
  const res = await fetch(`${SHOTSTACK_API_URL}/render`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Shotstack error: ${JSON.stringify(json)}`);
  return json?.response?.id || json?.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Solo cron jobs o callers con service-role. Sin esto, cualquiera podía
  // forzar generación de videos en Shotstack consumiendo créditos del cliente.
  if (!requireServiceRole(req)) {
    return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tournament_id } = await req.json();
    if (!tournament_id) {
      return new Response(JSON.stringify({ ok: false, error: "tournament_id required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "SHOTSTACK_API_KEY not configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, name, prize_pool_usd, participants_count, status")
      .eq("id", tournament_id)
      .maybeSingle();

    if (tErr || !tournament) {
      return new Response(JSON.stringify({ ok: false, error: "tournament not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotencia
    const { data: existing } = await supabase
      .from("tournament_highlights")
      .select("id")
      .eq("tournament_id", tournament_id)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, message: "already queued" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Top 3 participantes
    const { data: parts } = await supabase
      .from("tournament_participants")
      .select("user_id, profit_pct, prize_won_usd, points_won, final_rank")
      .eq("tournament_id", tournament_id)
      .not("final_rank", "is", null)
      .lte("final_rank", 3)
      .order("final_rank", { ascending: true });

    if (!parts || parts.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "no ranked participants" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Hidratar usernames
    const userIds = parts.map((p: any) => p.user_id);
    const { data: users } = await supabase
      .from("tournament_users")
      .select("id, username, avatar_url")
      .in("id", userIds);
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    const top3 = parts.map((p: any) => ({ ...p, username: userMap.get(p.user_id)?.username }));

    const callbackUrl = `${supabaseUrl}/functions/v1/tournament-highlight-webhook`;

    // 1. Highlight general
    try {
      const generalPayload = buildGeneralTimeline(tournament, top3);
      const renderId = await submitShotstack(generalPayload, SHOTSTACK_API_KEY, callbackUrl);
      await supabase.from("tournament_highlights").insert({
        tournament_id,
        kind: "general",
        status: "rendering",
        shotstack_render_id: renderId,
        scenes_data: { top3 },
      });
    } catch (e: any) {
      console.error("general render failed:", e.message);
      await supabase.from("tournament_highlights").insert({
        tournament_id,
        kind: "general",
        status: "failed",
        error_message: e.message,
      });
    }

    // 2. Highlights individuales para top 3
    for (const p of top3) {
      try {
        const winnerPayload = buildWinnerTimeline(tournament, p, p.final_rank);
        const renderId = await submitShotstack(winnerPayload, SHOTSTACK_API_KEY, callbackUrl);
        await supabase.from("tournament_highlights").insert({
          tournament_id,
          user_id: p.user_id,
          kind: "winner",
          status: "rendering",
          shotstack_render_id: renderId,
          scenes_data: { rank: p.final_rank, username: p.username },
        });
      } catch (e: any) {
        console.error(`winner #${p.final_rank} render failed:`, e.message);
        await supabase.from("tournament_highlights").insert({
          tournament_id,
          user_id: p.user_id,
          kind: "winner",
          status: "failed",
          error_message: e.message,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, queued: 1 + top3.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("tournament-auto-highlight error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
