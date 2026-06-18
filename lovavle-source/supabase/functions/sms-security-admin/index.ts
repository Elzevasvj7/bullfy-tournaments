import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ok = (data: any) => new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
  });
  const err = (msg: string) => new Response(JSON.stringify({ ok: false, error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
  });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";

    const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: auth } } });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return err("No autenticado");

    const admin = createClient(supaUrl, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ud.user.id).eq("role", "global_admin").maybeSingle();
    if (!roleRow) return err("Solo global_admin");

    const { action, payload = {} } = await req.json();

    if (action === "list") {
      const [{ data: blocklist }, { data: config }] = await Promise.all([
        admin.from("sms_phone_blocklist").select("*").order("blocked_at", { ascending: false }),
        admin.from("sms_rate_limit_config").select("*").eq("id", 1).maybeSingle(),
      ]);
      return ok({ blocklist: blocklist || [], config });
    }

    if (action === "add_block") {
      const phone = String(payload.phone || "").trim();
      const reason = String(payload.reason || "manual").trim();
      if (!phone.startsWith("+")) return err("Formato E.164 requerido (+...)");
      const { error } = await admin.from("sms_phone_blocklist").insert({ phone, reason, blocked_by: ud.user.id });
      if (error) return err(error.message);
      return ok({});
    }

    if (action === "remove_block") {
      const phone = String(payload.phone || "").trim();
      const { error } = await admin.from("sms_phone_blocklist").delete().eq("phone", phone);
      if (error) return err(error.message);
      return ok({});
    }

    if (action === "update_config") {
      const upd: any = { updated_at: new Date().toISOString(), updated_by: ud.user.id };
      ["email_purpose_per_10min", "phone_per_10min", "phone_per_24h"].forEach(k => {
        if (payload[k] !== undefined) upd[k] = Math.max(1, Math.min(100, Number(payload[k])));
      });
      const { error } = await admin.from("sms_rate_limit_config").update(upd).eq("id", 1);
      if (error) return err(error.message);
      return ok({});
    }

    return err("Acción no reconocida");
  } catch (e: any) {
    return err(e.message || String(e));
  }
});
