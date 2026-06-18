import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ATFXAction =
  // utils / sistema
  | "test_connection" | "list_products"
  | "list_adapters" | "list_trading_groups" | "list_webhooks" | "audit_log"
  // broker · clientes
  | "list_customers" | "customer_detail" | "customer_accounts" | "customer_transactions"
  | "customer_kyc_documents" | "customer_login_history" | "customer_notes"
  // broker · transacciones
  | "list_transactions" | "list_internal_transfers" | "list_manual_adjustments" | "list_commissions"
  // broker · trading
  | "list_open_trades" | "list_closed_trades" | "list_pending_orders" | "list_symbols"
  // broker · cuentas
  | "list_accounts" | "account_detail"
  // broker · agentes
  | "report_agents" | "agent_detail" | "agent_referrals" | "agent_commissions" | "agent_hierarchy" | "agent_payouts"
  // broker · promos
  | "list_bonuses" | "list_promotions" | "list_coupons"
  // broker · financieros
  | "report_volume" | "report_profit" | "report_pamm" | "report_store_revenue"
  // broker · store
  | "list_store_orders" | "list_subscriptions"
  // prop
  | "prop_overview"
  | "list_challenges" | "challenge_types" | "challenge_detail"
  | "list_participants" | "participant_detail" | "participant_goals" | "participant_phases" | "participant_trades" | "participant_resets"
  | "prop_sales_summary" | "prop_sales_by_type" | "prop_revenue_total" | "prop_conversion_rate" | "prop_arpu_ltv" | "prop_coupons"
  | "prop_payouts"
  | "prop_open_trades" | "prop_closed_trades" | "prop_drawdown_alerts" | "prop_equity_curve"
  | "funded_accounts" | "funded_performance" | "funded_breaches"
  // misc
  | "raw";

export interface ATFXResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  raw?: unknown;
  url?: string;
  status?: number;
  [k: string]: any;
}

export async function callATFX<T = any>(action: ATFXAction, payload?: any): Promise<ATFXResponse<T>> {
  const { data, error } = await supabase.functions.invoke("atfx-proxy", {
    body: { action, payload },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return data as ATFXResponse<T>;
}

export function useATFX<T = any>(
  action: ATFXAction,
  payload?: any,
  options?: Omit<UseQueryOptions<ATFXResponse<T>, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<ATFXResponse<T>, Error>({
    queryKey: ["atfx", action, payload],
    queryFn: () => callATFX<T>(action, payload),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}
