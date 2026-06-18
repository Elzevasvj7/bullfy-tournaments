import { useOnboardingStore } from "@/stores/onboardingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import IBContextBanner from "../IBContextBanner";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

/**
 * Estimación de lotes mensuales por cada $1,000 de depósito.
 * Basado en datos estadísticos de trading forex retail:
 * - Conservadora: ~0.5 lotes/mes por $1,000 (bajo apalancamiento, swing trading)
 * - Moderada: ~1.5 lotes/mes por $1,000 (apalancamiento medio, day trading)
 * - Agresiva: ~3.5 lotes/mes por $1,000 (alto apalancamiento, scalping/day trading frecuente)
 */
const LOTES_POR_1000: Record<string, number> = {
  Conservadora: 0.5,
  Moderada: 1.5,
  Agresiva: 3.5,
};

const estrategias = [
  {
    value: "Conservadora" as const,
    label: "Conservadora",
    desc: "Bajo riesgo · Swing trading · ~0.5 lotes/$1K",
    icon: TrendingDown,
  },
  {
    value: "Moderada" as const,
    label: "Moderada",
    desc: "Riesgo medio · Day trading · ~1.5 lotes/$1K",
    icon: Activity,
  },
  {
    value: "Agresiva" as const,
    label: "Agresiva",
    desc: "Alto riesgo · Scalping · ~3.5 lotes/$1K",
    icon: TrendingUp,
  },
];

const StepPerformance = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const { data: accountTypes } = useQuery({
    queryKey: ["ref_propfirm_cuentas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_propfirm_cuentas").select("*").order("tipo").order("balance");
      if (error) throw error;
      return data;
    },
  });

  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";
  const onlyPropFirm = formData.modelo_negocio === "PropFirm";

  // Auto-calculate lots when deposits or strategy change (and not manual)
  const lotesEstimados = useMemo(() => {
    if (!formData.estrategia_trading || !formData.depositos_por_mes) return 0;
    const factor = LOTES_POR_1000[formData.estrategia_trading] || 0;
    return Math.round((formData.depositos_por_mes / 1000) * factor * 100) / 100;
  }, [formData.depositos_por_mes, formData.estrategia_trading]);

  useEffect(() => {
    if (!formData.lotes_manual && lotesEstimados > 0) {
      updateFormData({ lotes_por_mes: lotesEstimados });
    }
  }, [lotesEstimados, formData.lotes_manual]);

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">IB Performance Calculator</h3>
        <p className="text-sm text-muted-foreground mt-1">¿Desea generar IB Performance Report?</p>
      </div>

      <RadioGroup
        value={formData.generar_performance ? "si" : "no"}
        onValueChange={(v) => updateFormData({ generar_performance: v === "si" })}
        className="flex gap-4"
      >
        {["si", "no"].map((val) => (
          <div
            key={val}
            className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
              (val === "si" ? formData.generar_performance : !formData.generar_performance)
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <RadioGroupItem value={val} id={`perf-${val}`} />
            <Label htmlFor={`perf-${val}`} className="cursor-pointer text-sm">
              {val === "si" ? "Sí" : "No"}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {formData.generar_performance && (
        <div className="space-y-6">
          {!onlyPropFirm && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clientes por mes</Label>
                <Input
                  type="number"
                  value={formData.clientes_por_mes || ""}
                  onChange={(e) => updateFormData({ clientes_por_mes: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Depósitos por mes ($)</Label>
                <Input
                  type="number"
                  value={formData.depositos_por_mes || ""}
                  onChange={(e) => updateFormData({ depositos_por_mes: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}

          {/* Estrategia de Trading — solo si no es PropFirm exclusivo */}
          {!onlyPropFirm && formData.depositos_por_mes > 0 && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Estrategia de Trading de los Clientes</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Seleccione el perfil de trading para estimar los lotes mensuales automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {estrategias.map((e) => {
                  const isSelected = formData.estrategia_trading === e.value;
                  const Icon = e.icon;
                  return (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => updateFormData({ estrategia_trading: e.value })}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium text-foreground">{e.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{e.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Resultado estimado */}
              {formData.estrategia_trading && !formData.lotes_manual && (
                <div className="rounded-md bg-accent/30 border border-accent/50 p-3">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Lotes estimados:</span>{" "}
                    <span className="text-primary font-bold text-lg">{lotesEstimados}</span>{" "}
                    <span className="text-muted-foreground">lotes/mes</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Basado en ${formData.depositos_por_mes.toLocaleString()} depósito · Estrategia {formData.estrategia_trading.toLowerCase()}
                  </p>
                </div>
              )}

              {/* Toggle manual */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.lotes_manual}
                  onCheckedChange={(v) => {
                    updateFormData({ lotes_manual: v });
                    if (!v) updateFormData({ lotes_por_mes: lotesEstimados });
                  }}
                />
                <Label className="text-sm">Ingresar lotes manualmente</Label>
              </div>

              {formData.lotes_manual && (
                <div className="space-y-2">
                  <Label>Lotes por mes (manual)</Label>
                  <Input
                    type="number"
                    value={formData.lotes_por_mes || ""}
                    onChange={(e) => updateFormData({ lotes_por_mes: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
          )}

          {showPropFirm && (
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Datos PropFirm</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cuentas fondeo vendidas por mes</Label>
                  <Input
                    type="number"
                    value={formData.cuentas_fondeo_vendidas || ""}
                    onChange={(e) => updateFormData({ cuentas_fondeo_vendidas: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cuenta</Label>
                  <Select
                    value={formData.tipo_cuenta_fondeo}
                    onValueChange={(v) => updateFormData({ tipo_cuenta_fondeo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes?.map((at) => (
                        <SelectItem key={at.id} value={`${at.tipo} - $${at.balance.toLocaleString()}`}>
                          {at.tipo} - ${at.balance.toLocaleString()} (${at.precio})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepPerformance;
