// ============================================================================
// notify-expiring-subscriptions (QA C7) — EF programada (cron diario).
// ----------------------------------------------------------------------------
// Escanea trading_room_subscriptions activas cuyo current_period_end cae dentro
// de los próximos N días y aún no fueron notificadas en este periodo, y envía
// el aviso de "tu suscripción está por vencer" al usuario.
//
// AGENDADO: el usuario la programa en Supabase (pg_cron / Scheduled Functions)
// para correr a diario, pasando el SERVICE_ROLE_KEY como Bearer en Authorization.
//
// Idempotente por periodo: marca expiry_notified_at tras enviar, y el filtro
// excluye las ya notificadas en el periodo actual → no reenvía cada día.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { notifySubscriptionExpiring } from "../_shared/notifications.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_AHEAD = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Guard: solo se permite con el service role key (lo pasa el scheduler).
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(serviceKey)) {
    return new Response(JSON.stringify({ ok: false, error: "no autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const now = new Date();
    const limit = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

    const { data: subs, error } = await supabase
      .from("trading_room_subscriptions")
      .select("id, partner_user_id, portal_id, current_period_start, current_period_end, expiry_notified_at")
      .eq("access_status", "active")
      .not("current_period_end", "is", null)
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", limit.toISOString());

    if (error) throw error;

    let sent = 0;
    for (const s of subs || []) {
      // Saltar si ya se notificó dentro del periodo actual. Si current_period_start
      // es NULL pero ya hay expiry_notified_at, tratamos como ya notificado (no
      // reenviar a diario) — robusto ante filas creadas manualmente sin start.
      if (s.expiry_notified_at &&
          (!s.current_period_start ||
           new Date(s.expiry_notified_at) >= new Date(s.current_period_start))) {
        continue;
      }
      const end = new Date(s.current_period_end);
      const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

      await notifySubscriptionExpiring(supabase, {
        portalId: s.portal_id,
        partnerUserId: s.partner_user_id,
        expiresAt: s.current_period_end,
        daysLeft,
      });
      await supabase
        .from("trading_room_subscriptions")
        .update({ expiry_notified_at: now.toISOString() })
        .eq("id", s.id);
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: subs?.length ?? 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-expiring-subscriptions]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
