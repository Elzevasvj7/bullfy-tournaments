import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getJson(url: string) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
      "User-Agent": "bullfy-network-egress-check",
    },
  });

  const text = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      url,
      body: JSON.parse(text),
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      url,
      body: text,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const [ipify, ifconfig, ipinfo] = await Promise.all([
      getJson("https://api.ipify.org?format=json"),
      getJson("https://ifconfig.me/all.json"),
      getJson("https://ipinfo.io/json"),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      data: {
        ipify,
        ifconfig,
        ipinfo,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});