import { supabase } from "@/integrations/supabase/client";

export type BridgeAction =
  | "health" | "health_ready"
  | "create_user" | "get_user" | "update_user" | "suspend" | "enable" | "change_password"
  | "get_deals" | "get_positions"
  | "get_account" | "deposit" | "withdrawal" | "credit_in" | "credit_out"
  | "create_order" | "list_orders" | "cancel_order" | "modify_order"
  | "close_position" | "close_all_positions" | "modify_position";

export interface BridgeRequest {
  action: BridgeAction;
  login?: string | number;
  ticket?: string | number;
  body?: Record<string, unknown>;
  query?: Record<string, string | number>;
}

export interface BridgeResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
  status?: number;
  latency_ms?: number;
}

export async function callMT5Bridge<T = unknown>(req: BridgeRequest): Promise<BridgeResponse<T>> {
  const { data, error } = await supabase.functions.invoke("mt5-bridge-proxy", { body: req });
  if (error) return { ok: false, error: error.message };
  return data as BridgeResponse<T>;
}
