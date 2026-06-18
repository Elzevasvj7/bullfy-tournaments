import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { Clock3, Lock, ShoppingCart, Check, AlertTriangle, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  plan_code: string;
  display_name: string;
  session_label: string | null;
  target_price_monthly: number;
  active_hours_per_month: number;
  notes: string | null;
}

interface Subscription {
  id: string;
  plan_id: string;
  access_status: string;
  billing_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  renewal_due_at: string | null;
  pending_invoice_url: string | null;
}

interface Props {
  plans: Plan[];
  portalId: string;
  partnerUserId: string;
  isTestUser: boolean;
  activeTestPlanIds: string[];
  onActivated: () => void;
}

const daysBetween = (a: Date, b: Date) => Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

export const PlanSelectorMenu = ({
  plans,
  portalId,
  partnerUserId,
  isTestUser,
  activeTestPlanIds,
  onActivated,
}: Props) => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadSubs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trading_room_subscriptions")
      .select("id, plan_id, access_status, billing_status, current_period_start, current_period_end, renewal_due_at, pending_invoice_url")
      .eq("partner_user_id", partnerUserId);
    if (!error) setSubs((data ?? []) as Subscription[]);
    setLoading(false);
  };

  useEffect(() => {
    loadSubs();
    // Poll every 15s to catch payment confirmations from NowPayments webhook
    const id = window.setInterval(loadSubs, 15000);
    return () => window.clearInterval(id);
  }, [partnerUserId]);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) setSelectedPlanId(plans[0].id);
  }, [plans, selectedPlanId]);

  const subByPlan = useMemo(() => {
    const m = new Map<string, Subscription>();
    subs.forEach((s) => m.set(s.plan_id, s));
    return m;
  }, [subs]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const selectedSub = selectedPlan ? subByPlan.get(selectedPlan.id) : undefined;

  const planStatus = (planId: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; days?: number } => {
    if (isTestUser && activeTestPlanIds.includes(planId)) return { label: "Prueba activa", variant: "default" };
    const sub = subByPlan.get(planId);
    if (!sub) return { label: "Sin contratar", variant: "outline" };
    if (sub.access_status === "active" && sub.current_period_end) {
      const days = daysBetween(new Date(sub.current_period_end), new Date());
      if (days <= 5) return { label: `Renovar (${days}d)`, variant: "destructive", days };
      return { label: `Activo (${days}d)`, variant: "default", days };
    }
    if (sub.access_status === "pending_payment") return { label: "Esperando pago", variant: "secondary" };
    if (sub.access_status === "expired") return { label: "Expirado", variant: "destructive" };
    return { label: sub.access_status, variant: "outline" };
  };

  const handleBuy = async () => {
    if (!selectedPlan) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-create-invoice", {
        body: { partner_user_id: partnerUserId, portal_id: portalId, plan_id: selectedPlan.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo crear el pago");
      if (data.invoice_url) {
        window.open(data.invoice_url, "_blank");
        toast.success("Abrimos NowPayments en una nueva pestaña. Completa el pago para activar tu plan.");
        await loadSubs();
        onActivated();
      } else {
        throw new Error("NowPayments no devolvió una URL de pago");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error iniciando el pago");
    } finally {
      setCreating(false);
    }
  };

  const status = selectedPlan ? planStatus(selectedPlan.id) : null;
  const isActive = status?.variant === "default" && !status.label.startsWith("Renovar");
  const isRenewing = status?.label.startsWith("Renovar");
  const isPending = selectedSub?.access_status === "pending_payment";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock3 className="w-5 h-5 text-primary" /> Selecciona tu Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando tus suscripciones...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => {
                    const s = planStatus(plan.id);
                    return (
                      <SelectItem key={plan.id} value={plan.id}>
                        <span className="flex items-center gap-2">
                          {plan.display_name}
                          <Badge variant={s.variant} className="ml-1 text-[10px]">{s.label}</Badge>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-base">{selectedPlan.display_name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedPlan.session_label || "Ventana dinámica por stream"}</p>
                  </div>
                  {status && <Badge variant={status.variant}>{status.label}</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Precio mensual</p>
                    <p className="font-bold text-foreground text-lg">${Number(selectedPlan.target_price_monthly).toFixed(2)}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Horas activas / mes</p>
                    <p className="font-bold text-foreground text-lg">{selectedPlan.active_hours_per_month}</p>
                  </div>
                </div>

                {selectedPlan.notes && (
                  <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3">{selectedPlan.notes}</p>
                )}

                {selectedSub?.current_period_end && isActive && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-success" />
                    Activo hasta {new Date(selectedSub.current_period_end).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}

                {isPending && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p>Esperando confirmación on-chain de NowPayments. Esto puede tomar varios minutos.</p>
                      {selectedSub?.pending_invoice_url && (
                        <a href={selectedSub.pending_invoice_url} target="_blank" rel="noreferrer" className="underline">
                          Reabrir checkout
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {isTestUser && activeTestPlanIds.includes(selectedPlan.id) ? (
                  <Button className="w-full" variant="secondary" disabled>
                    <Check className="w-4 h-4 mr-1" /> Plan de prueba habilitado por IB
                  </Button>
                ) : isActive && !isRenewing ? (
                  <Button className="w-full" variant="secondary" disabled>
                    <Check className="w-4 h-4 mr-1" /> Plan activo
                  </Button>
                ) : (
                  <Button className="w-full" onClick={handleBuy} disabled={creating || isPending}>
                    {creating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creando pago...</>
                    ) : isRenewing ? (
                      <><ShoppingCart className="w-4 h-4 mr-1" /> Renovar — ${Number(selectedPlan.target_price_monthly).toFixed(2)}</>
                    ) : selectedSub?.access_status === "expired" ? (
                      <><ShoppingCart className="w-4 h-4 mr-1" /> Reactivar — ${Number(selectedPlan.target_price_monthly).toFixed(2)}</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4 mr-1" /> Comprar — ${Number(selectedPlan.target_price_monthly).toFixed(2)} USD</>
                    )}
                  </Button>
                )}

                <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Pago seguro vía NowPayments (crypto)
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanSelectorMenu;
