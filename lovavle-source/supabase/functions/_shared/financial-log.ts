// ============================================================================
// Logger de eventos financieros (QA Fase 3 / P6) — best-effort.
// ----------------------------------------------------------------------------
// Inserta una fila en public.financial_events por cada movimiento de dinero
// (inicio/éxito/fallo). Es BEST-EFFORT: envuelto en try/catch, NUNCA lanza ni
// bloquea el flujo principal. Lo usan las edge functions con service_role
// (que bypassa RLS). El objetivo es trazabilidad consultable de quién/qué/
// cuánto/resultado/error de cada operación de dinero.
// ============================================================================

export interface FinancialEvent {
  function_name: string;
  event_type: string;
  gateway?: string | null;
  portal_id?: string | null;
  order_id?: string | null;
  withdrawal_id?: string | null;
  partner_user_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  result?: "success" | "failed" | "skipped";
  error_message?: string | null;
  payload?: unknown;
}

export async function logFinancialEvent(supabase: any, e: FinancialEvent): Promise<void> {
  try {
    await supabase.from("financial_events").insert({
      function_name: e.function_name,
      event_type: e.event_type,
      gateway: e.gateway ?? null,
      portal_id: e.portal_id ?? null,
      order_id: e.order_id ?? null,
      withdrawal_id: e.withdrawal_id ?? null,
      partner_user_id: e.partner_user_id ?? null,
      amount: e.amount ?? null,
      currency: e.currency ?? null,
      result: e.result ?? "success",
      error_message: e.error_message ? String(e.error_message).slice(0, 2000) : null,
      payload: e.payload ?? null,
    });
  } catch (err) {
    // Nunca romper el flujo por un fallo de logging.
    console.error("[financial-log] insert failed:", err);
  }
}
