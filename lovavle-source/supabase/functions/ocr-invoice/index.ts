// OCR de facturas vía Lovable AI Gateway (Gemini Vision)
// Body: { invoice_id: uuid }  → lee accounting_invoices.file_url y extrae datos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Eres un experto en lectura de facturas/recibos. Analiza la imagen y devuelve SOLO JSON válido con la estructura:
{
  "vendor_name": string | null,
  "invoice_number": string | null,
  "issue_date": "YYYY-MM-DD" | null,
  "currency": "USD"|"COP"|"AED"|"EUR"|"MXN"|"GBP"|"BRL"|"ARS"|"CLP"|"PEN" | null,
  "amount_total": number | null,
  "tax_amount": number | null,
  "category_guess": string | null,
  "confidence": number  // 0..1
}
Si no detectas un campo usa null. No incluyas texto fuera del JSON.`;

function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI no devolvió JSON");
  return JSON.parse(match[0]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "LOVABLE_API_KEY no configurada" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id requerido");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inv, error: invErr } = await supabase
      .from("accounting_invoices").select("id, file_url, file_name")
      .eq("id", invoice_id).single();
    if (invErr || !inv) throw new Error("Factura no encontrada");

    // Crear signed URL si es bucket privado
    let imageUrl = inv.file_url as string;
    if (imageUrl && imageUrl.includes("/accounting-invoices/")) {
      const path = imageUrl.split("/accounting-invoices/")[1]?.split("?")[0];
      if (path) {
        const { data: signed } = await supabase.storage
          .from("accounting-invoices").createSignedUrl(decodeURIComponent(path), 600);
        if (signed?.signedUrl) imageUrl = signed.signedUrl;
      }
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ ok: false, error: "Rate limit IA — intenta de nuevo en unos segundos" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ ok: false, error: "Sin créditos de IA. Agrega créditos en Workspace > Usage" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);

    const aiJson = await aiRes.json();
    const text = aiJson?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);

    const update: Record<string, unknown> = {
      ocr_raw: parsed,
      ocr_confidence: parsed.confidence ?? null,
      vendor_name: parsed.vendor_name ?? null,
      invoice_number: parsed.invoice_number ?? null,
      issue_date: parsed.issue_date ?? null,
      currency_original: parsed.currency ?? null,
      amount_original: parsed.amount_total ?? null,
      tax_amount: parsed.tax_amount ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("accounting_invoices").update(update).eq("id", invoice_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, invoice_id, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
