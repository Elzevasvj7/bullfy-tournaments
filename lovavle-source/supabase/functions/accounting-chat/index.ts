// Chat contable RAG con Gemini Flash sobre datos consolidados.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const authHeader = req.headers.get("Authorization") || "";
    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (!user) throw new Error("unauthorized");

    const { question, session_id } = await req.json();
    if (!question) throw new Error("question required");

    // Recolectar contexto: últimos 30 días de KPIs
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [exp, rev, transfers, alerts] = await Promise.all([
      supa.from("accounting_expenses").select("amount_usd,category_id,expense_date,vendor_id").gte("expense_date", since.slice(0, 10)),
      supa.from("accounting_revenues").select("amount_usd,revenue_date,source_type").gte("revenue_date", since.slice(0, 10)),
      supa.from("accounting_treasury_transfers").select("amount_usd,amount_justified_usd,status,recipient_user_id"),
      supa.from("accounting_budget_alerts").select("severity,message").is("acknowledged_at", null).limit(20),
    ]);

    const totalExp = (exp.data ?? []).reduce((s, x) => s + Number(x.amount_usd || 0), 0);
    const totalRev = (rev.data ?? []).reduce((s, x) => s + Number(x.amount_usd || 0), 0);
    const outstanding = (transfers.data ?? []).reduce((s, t) => s + (Number(t.amount_usd) - Number(t.amount_justified_usd || 0)), 0);

    await supa.from("accounting_chat_messages").insert({
      session_id, user_id: user.id, role: "user", content: question,
    });

    const ctx = {
      ventana: "últimos 30 días",
      gastos_total_usd: totalExp.toFixed(2),
      ingresos_total_usd: totalRev.toFixed(2),
      net_usd: (totalRev - totalExp).toFixed(2),
      transfers_pendientes_justificar_usd: outstanding.toFixed(2),
      alertas_presupuesto_abiertas: alerts.data?.length || 0,
      muestra_alertas: alerts.data?.slice(0, 5) || [],
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un asistente contable de Bullfy. Responde en español, breve, con cifras en USD. Si te falta info, dilo." },
          { role: "user", content: `CONTEXTO:\n${JSON.stringify(ctx)}\n\nPREGUNTA: ${question}` },
        ],
      }),
    });
    const aj = await aiRes.json();
    const answer = aj.choices?.[0]?.message?.content || "Sin respuesta";

    await supa.from("accounting_chat_messages").insert({
      session_id, user_id: user.id, role: "assistant", content: answer, context: ctx,
    });

    return new Response(JSON.stringify({ ok: true, answer, context: ctx }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
