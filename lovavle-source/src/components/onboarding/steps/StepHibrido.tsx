import { useEffect } from "react";
import { useOnboardingStore, HybridConfig } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import IBContextBanner from "../IBContextBanner";
import SpreadTable from "../SpreadTable";
import { DEFAULT_BROKER_GAIN, useBrokerPropSettings } from "@/hooks/useBrokerPropSettings";
import { calculateHybridClientSpread } from "@/lib/spreadCalculations";

const StepHibrido = () => {
  const { formData, updateFormData } = useOnboardingStore();
  const { data: brokerSettings } = useBrokerPropSettings();
  const brokerGain = brokerSettings?.gananciaBroker ?? DEFAULT_BROKER_GAIN;

  const { data: refHybrid } = useQuery({
    queryKey: ["ref_cpa_hibrido"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_cpa_hibrido").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (refHybrid && formData.hybrid_config.length === 0) {
      const config: HybridConfig[] = refHybrid.map((h) => ({
        rango_deposito: h.rango_deposito,
        cpa_pagar: h.cpa_pagar,
        dolares_por_lote: h.dolares_por_lote,
      }));
      updateFormData({ hybrid_config: config });
    }
  }, [refHybrid]);

  const updateHybrid = (
    index: number,
    field: "rango_deposito" | "cpa_pagar" | "dolares_por_lote",
    value: string | number
  ) => {
    const updated = [...formData.hybrid_config];
    updated[index] = { ...updated[index], [field]: value } as typeof updated[number];
    updateFormData({ hybrid_config: updated });
  };

  // Spread calculation for hybrid
  const handleDolarLoteChange = (value: string) => {
    const newVal = value ? parseFloat(value) : null;
    updateFormData({ hybrid_nuevo_dolar_lote: newVal });
    if (newVal !== null && formData.spread_config.length > 0) {
      const updated = formData.spread_config.map((s) => ({
        ...s,
        nuevo_dolar_ib: newVal,
        ...(() => {
          const { diff, nuevoSpread } = calculateHybridClientSpread(s, brokerGain, newVal);
          return { diferencia: diff, nuevo_spread_cliente: nuevoSpread };
        })(),
      }));
      updateFormData({ spread_config: updated });
    }
  };

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Modelo Híbrido</h3>
        <p className="text-sm text-muted-foreground mt-1">Combinación de CPA y dólares por lote</p>
      </div>

      {/* Spread Table - shows custom columns when not using defaults */}
      <SpreadTable
        readOnly
        forceShowCustom={!formData.usar_hybrid_default && formData.hybrid_nuevo_dolar_lote !== null}
        baseDolarOverride={brokerGain}
      />

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-xs">Rango de Depósito</TableHead>
              <TableHead className="text-xs text-right">CPA ($)</TableHead>
              <TableHead className="text-xs text-right">Dólares por Lote ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.hybrid_config.map((h, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">
                  <Input
                    value={h.rango_deposito}
                    onChange={(e) => {
                      updateFormData({ usar_hybrid_default: false });
                      updateHybrid(i, "rango_deposito", e.target.value);
                    }}
                    placeholder="Ej: 0-499"
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="1"
                    value={h.cpa_pagar}
                    onChange={(e) => {
                      updateFormData({ usar_hybrid_default: false });
                      updateHybrid(i, "cpa_pagar", e.target.value === "" ? 0 : parseFloat(e.target.value));
                    }}
                    className="h-8 text-sm text-right max-w-[110px] ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.5"
                    value={h.dolares_por_lote}
                    onChange={(e) => {
                      updateFormData({ usar_hybrid_default: false });
                      updateHybrid(i, "dolares_por_lote", e.target.value === "" ? 0 : parseFloat(e.target.value));
                    }}
                    className="h-8 text-sm text-right max-w-[110px] ml-auto"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Label className="text-sm font-semibold">¿Desea mantener valores por defecto?</Label>
        <RadioGroup
          value={formData.usar_hybrid_default ? "si" : "no"}
          onValueChange={(v) => {
            const useDefault = v === "si";
            updateFormData({ usar_hybrid_default: useDefault });
            if (useDefault && refHybrid) {
              updateFormData({
                hybrid_config: refHybrid.map((h) => ({
                  rango_deposito: h.rango_deposito,
                  cpa_pagar: h.cpa_pagar,
                  dolares_por_lote: h.dolares_por_lote,
                })),
                hybrid_nuevo_dolar_lote: null,
              });
            }
          }}
          className="flex gap-4 mt-2"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.usar_hybrid_default : !formData.usar_hybrid_default)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`hybrid-default-${val}`} />
              <Label htmlFor={`hybrid-default-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí, mantener" : "Cambiar"}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {!formData.usar_hybrid_default && (
        <div className="space-y-2">
          <Label>Nuevo dólar por lote (para cálculo de spread)</Label>
          <Input
            type="number"
            step="0.5"
            value={formData.hybrid_nuevo_dolar_lote ?? ""}
            onChange={(e) => handleDolarLoteChange(e.target.value)}
            placeholder="Ej: 6"
            className="max-w-[200px]"
          />
        </div>
      )}
    </div>
  );
};

export default StepHibrido;
