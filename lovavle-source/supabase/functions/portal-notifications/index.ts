// ============================================================================
// portal-notifications (QA C7) — dispatcher de notificaciones invocado desde el
// cliente (anon) para eventos que ocurren client-side: inscripción a evento/
// clase y registro de usuario pendiente de aprobación.
//
// El cliente solo envía IDs; esta función (service_role) RESUELVE los emails y
// VALIDA que el hecho realmente ocurrió (que la inscripción/usuario existe)
// antes de enviar, para que no se pueda usar para spamear emails arbitrarios.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  notifyRegistration,
  notifyApprovalPending,
  notifyApprovalGranted,
} from "../_shared/notifications.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Anti email-bombing: "reclama" la notificación insertando en
// portal_notification_log (UNIQUE event+ref_key). Devuelve false si ya se envió
// (conflicto 23505) → el caller omite el envío. Ante un error transitorio,
// devuelve true para no perder una notificación legítima (best-effort).
async function claim(supabase: any, event: string, refKey: string): Promise<boolean> {
  const { error } = await supabase
    .from("portal_notification_log")
    .insert({ event, ref_key: refKey });
  if (error) {
    if (error.code === "23505") return false; // ya enviado
    console.warn("[portal-notifications] claim error (se envía igual)", error);
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const event: string = body?.event;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (event === "event_registration") {
      const { portal_id, event_id, partner_user_id } = body;
      if (!portal_id || !event_id || !partner_user_id) return bad();
      // Validar que la inscripción existe realmente.
      const { data: reg } = await supabase
        .from("portal_event_registrations")
        .select("id, portal_events:event_id(title, starts_at, portal_id)")
        .eq("event_id", event_id)
        .eq("partner_user_id", partner_user_id)
        .maybeSingle();
      const ev = (reg as any)?.portal_events;
      if (!reg || !ev || ev.portal_id !== portal_id) return ok(); // nada que notificar
      if (!(await claim(supabase, "event_registration", `${event_id}:${partner_user_id}`))) return ok();
      await notifyRegistration(supabase, {
        portalId: portal_id, partnerUserId: partner_user_id,
        kind: "evento", title: ev.title, startsAt: ev.starts_at,
      });
      return ok();
    }

    if (event === "class_registration") {
      const { portal_id, class_id, partner_user_id } = body;
      if (!portal_id || !class_id || !partner_user_id) return bad();
      const { data: reg } = await supabase
        .from("portal_class_registrations")
        .select("id, portal_classes:class_id(title, starts_at, portal_id)")
        .eq("class_id", class_id)
        .eq("partner_user_id", partner_user_id)
        .maybeSingle();
      const cl = (reg as any)?.portal_classes;
      if (!reg || !cl || cl.portal_id !== portal_id) return ok();
      if (!(await claim(supabase, "class_registration", `${class_id}:${partner_user_id}`))) return ok();
      await notifyRegistration(supabase, {
        portalId: portal_id, partnerUserId: partner_user_id,
        kind: "clase", title: cl.title, startsAt: cl.starts_at,
      });
      return ok();
    }

    if (event === "approval_pending") {
      const { portal_id, partner_user_id } = body;
      if (!portal_id || !partner_user_id) return bad();
      // Validar que el usuario existe en ese portal y está pendiente.
      const { data: user } = await supabase
        .from("partner_users")
        .select("nombre, email, status, portal_id")
        .eq("id", partner_user_id)
        .maybeSingle();
      if (!user || user.portal_id !== portal_id || user.status !== "pending") return ok();
      if (!(await claim(supabase, "approval_pending", partner_user_id))) return ok();
      await notifyApprovalPending(supabase, {
        portalId: portal_id, userName: user.nombre, userEmail: user.email,
      });
      return ok();
    }

    if (event === "approval_granted") {
      const { portal_id, partner_user_id } = body;
      if (!portal_id || !partner_user_id) return bad();
      // Solo se envía si el usuario YA está aprobado (no se puede usar para
      // notificar aprobaciones que no ocurrieron).
      const { data: user } = await supabase
        .from("partner_users")
        .select("status, portal_id")
        .eq("id", partner_user_id)
        .maybeSingle();
      if (!user || user.portal_id !== portal_id || user.status !== "approved") return ok();
      if (!(await claim(supabase, "approval_granted", partner_user_id))) return ok();
      await notifyApprovalGranted(supabase, { portalId: portal_id, partnerUserId: partner_user_id });
      return ok();
    }

    return bad("evento no soportado");
  } catch (e) {
    console.error("[portal-notifications]", e);
    // Best-effort: nunca propagar error al cliente para no romper su flujo.
    return ok();
  }

  function ok() {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  function bad(msg = "parámetros incompletos") {
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
