// Verificación server-to-server del estado de un depósito en Coinsbuy.
// Se usa desde los receptores de webhook (coinsbuy-callback y
// tournament-pay-webhook?gw=coinsbuy) para NO confiar en el cuerpo del
// webhook entrante: pedimos a Coinsbuy directamente cuál es el estado real
// del depósito antes de acreditar nada.
//
// Esta vía evita depender del esquema de firma HMAC de Coinsbuy, que aún
// no hemos podido confirmar contra su documentación oficial.

const PROXY_URL = Deno.env.get("COINSBUY_PROXY_URL");
const PROXY_TOKEN = Deno.env.get("COINSBUY_PROXY_TOKEN");

interface CoinsbuyConfig {
  client_id?: string;
  client_secret?: string;
  environment?: string;
}

export interface CoinsbuyDeposit {
  id: string;
  status: string | number;
  // Coinsbuy devuelve el monto declarado bajo target_amount_requested (no
  // target_amount, que es como se manda en el POST de creación). Validado
  // contra un response real del endpoint GET /deposit/{id}.
  target_amount?: string | number;
  tracking_id?: string;
}

function envPrefix(c: CoinsbuyConfig): string {
  return c.environment === "production" ? "production" : "sandbox";
}

// Encapsula la lógica de llamar a la API de Coinsbuy a través del proxy VPS
// (si está configurado) o directo (si la IP está en la whitelist).
async function coinsbuyFetch(
  c: CoinsbuyConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (PROXY_URL && PROXY_TOKEN) {
    const headers = new Headers(init.headers || {});
    headers.set("X-Proxy-Token", PROXY_TOKEN);
    return fetch(`${PROXY_URL}/${envPrefix(c)}/${path}`, { ...init, headers });
  }
  const direct = c.environment === "production"
    ? "https://v3.api.coinsbuy.com"
    : "https://v3.api-sandbox.coinsbuy.com";
  return fetch(`${direct}/${path}`, init);
}

async function getAccessToken(c: CoinsbuyConfig): Promise<string | null> {
  if (!c.client_id || !c.client_secret) return null;
  const r = await coinsbuyFetch(c, "token/", {
    method: "POST",
    headers: { "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify({
      data: {
        type: "auth-token",
        attributes: { client_id: c.client_id, client_secret: c.client_secret },
      },
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.data?.attributes?.access ?? null;
}

/**
 * Pide a Coinsbuy el estado real del depósito.
 * Retorna null si:
 *   - depositId vacío
 *   - integration_settings no tiene config válida
 *   - la API rechaza (auth fail, deposit not found, network error)
 *
 * El llamador DEBE rechazar el webhook si esta función retorna null o si el
 * status devuelto no es "paid" / 3.
 */
export async function fetchCoinsbuyDeposit(
  supa: any,
  depositId: string,
): Promise<CoinsbuyDeposit | null> {
  if (!depositId) return null;

  const { data } = await supa.from("integration_settings")
    .select("config, enabled").eq("service_name", "coinsbuy").maybeSingle();
  if (!data?.enabled || !data?.config) {
    console.error("coinsbuy_verify: integration_settings no disponible");
    return null;
  }

  const config = data.config as CoinsbuyConfig;
  const token = await getAccessToken(config);
  if (!token) {
    console.error("coinsbuy_verify: no se pudo obtener access token");
    return null;
  }

  const r = await coinsbuyFetch(config, `deposit/${depositId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/vnd.api+json",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!r.ok) {
    console.error("coinsbuy_verify: GET deposit falló", { depositId, status: r.status });
    return null;
  }

  const j = await r.json();
  const attrs = j?.data?.attributes;
  const id = j?.data?.id;
  if (!attrs || !id) {
    console.error("coinsbuy_verify: respuesta inesperada de Coinsbuy", { depositId });
    return null;
  }

  return {
    id,
    status: attrs.status,
    // Mapeo del campo real que devuelve la API de Coinsbuy. En el POST de
    // creación se manda como `target_amount`, pero en el GET viene como
    // `target_amount_requested`. Fallback a `target_amount` por si en otros
    // endpoints el nombre coincide con lo que se mandó al crear.
    target_amount: attrs.target_amount_requested ?? attrs.target_amount,
    tracking_id: attrs.tracking_id,
  };
}

// Coinsbuy API v3 usa códigos numéricos: 2=Created, 3=Paid, 4=Canceled, 5=Unresolved.
// El callback también puede mandar strings textuales — aceptamos ambas formas.
export function isCoinsbuyPaid(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return ["3", "paid", "completed", "confirmed", "success", "successful"].includes(s);
}
