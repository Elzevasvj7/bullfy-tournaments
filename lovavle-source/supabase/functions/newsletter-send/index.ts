import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSb = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userSb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const { edition_id, test_email, custom_emails } = await req.json();

    if (!edition_id) {
      return new Response(JSON.stringify({ ok: false, error: "edition_id required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: edition } = await sb.from("newsletter_editions")
      .select("*").eq("id", edition_id).single();

    if (!edition) {
      return new Response(JSON.stringify({ ok: false, error: "Edición no encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = edition.content_json?.html || "<p>Newsletter sin contenido</p>";
    const subject = `🐂 ${edition.content_json?.copy?.main_headline || "Bullfy Markets Daily"}`;

    // Build prediction URL
    const predictionBaseUrl = `${supabaseUrl}/functions/v1/newsletter-submit-prediction`;
    let finalHtml = html;

    // Replace prediction URL placeholder
    if (edition.prediction_question) {
      const predUrl = `https://bullfyibsystem.lovable.app/newsletter-results/${edition_id}`;
      finalHtml = finalHtml.replace(/\{\{PREDICTION_URL\}\}/g, predUrl);
    }

    let recipients: string[] = [];
    const skipStatusUpdate = !!custom_emails?.length;

    if (custom_emails?.length) {
      // Custom emails: send to specific list without changing edition status
      recipients = custom_emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    } else if (edition.environment === "test" || test_email) {
      // Test mode: send only to specified email or current user
      recipients = [test_email || user.email!];
    } else {
      // Production: get emails from target roles
      const targetRoles = edition.target_roles || [];

      if (targetRoles.length > 0) {
        // Get user IDs with matching roles
        const { data: roleUsers } = await sb.from("user_roles")
          .select("user_id")
          .in("role", targetRoles);

        if (roleUsers?.length) {
          const userIds = roleUsers.map((r: any) => r.user_id);
          const { data: profiles } = await sb.from("profiles")
            .select("correo")
            .in("id", userIds)
            .not("correo", "is", null);

          recipients = (profiles || []).map((p: any) => p.correo).filter(Boolean);
        }

        // Also include partner_users if targeting partner roles
        if (targetRoles.includes("partner_users")) {
          const { data: partnerUsers } = await sb.from("partner_users")
            .select("email")
            .eq("status", "approved");
          const partnerEmails = (partnerUsers || []).map((p: any) => p.email).filter(Boolean);
          recipients = [...new Set([...recipients, ...partnerEmails])];
        }
      }
    }

    // Send via Resend
    let sentCount = 0;
    const batchSize = 50;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Bullfy Markets <noreply@bullfytech.online>",
              to: [email],
              subject,
              html: finalHtml,
            }),
          });

          if (res.ok) sentCount++;
          else {
            const errText = await res.text();
            console.error(`Failed to send to ${email}:`, errText);
          }
        } catch (e) {
          console.error(`Error sending to ${email}:`, e);
        }
      }

      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Update edition (skip if sending to custom emails list)
    if (!skipStatusUpdate) {
      await sb.from("newsletter_editions").update({
        status: "sent",
        sent_count: sentCount,
        sent_at: new Date().toISOString(),
      }).eq("id", edition_id);
    }

    return new Response(JSON.stringify({ ok: true, sent_count: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("newsletter-send error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
