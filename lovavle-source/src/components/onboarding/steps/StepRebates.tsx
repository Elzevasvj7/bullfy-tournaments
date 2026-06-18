import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IBContextBanner from "../IBContextBanner";
import SpreadTable from "../SpreadTable";
import { calculateRebateClientSpread } from "@/lib/spreadCalculations";

const StepRebates = () => {
  const { formData, updateFormData } = useOnboardingStore();

  // Initialize sub IB allocations when switching to custom mode
  useEffect(() => {
    if (!formData.usar_spreads_default && formData.tiene_sub_ibs && formData.sub_ibs.length > 0) {
      if (formData.sub_ib_rebate_allocations.length === 0) {
        const allocations = formData.sub_ibs.map((sub) => ({
          nombre: sub.nombre,
          correo: sub.correo,
          dolares_asignados: 0,
        }));
        updateFormData({ sub_ib_rebate_allocations: allocations });
      }
    }
  }, [formData.usar_spreads_default, formData.tiene_sub_ibs]);

  const handleGlobalChange = (value: string) => {
    const newVal = value ? parseFloat(value) : null;
    updateFormData({ nuevo_dolar_ib_global: newVal });
    if (newVal !== null) {
      const updated = formData.spread_config.map((s) => {
        const { diff, nuevoSpread } = calculateRebateClientSpread(s, newVal);
        return {
          ...s,
          nuevo_dolar_ib: newVal,
          diferencia: diff,
          nuevo_spread_cliente: nuevoSpread,
        };
      });
      updateFormData({ spread_config: updated });
      const totalSubIBs = formData.sub_ib_rebate_allocations.reduce((sum, a) => sum + a.dolares_asignados, 0);
      updateFormData({ dolares_ib_restante: newVal - totalSubIBs });
    } else {
      updateFormData({ dolares_ib_restante: null });
    }
  };

  const handleSubIBAllocation = (index: number, value: string) => {
    const numVal = value ? parseFloat(value) : 0;
    const updated = [...formData.sub_ib_rebate_allocations];
    updated[index] = { ...updated[index], dolares_asignados: numVal };
    const totalSubIBs = updated.reduce((sum, a) => sum + a.dolares_asignados, 0);
    const globalVal = formData.nuevo_dolar_ib_global ?? 0;
    updateFormData({
      sub_ib_rebate_allocations: updated,
      dolares_ib_restante: globalVal - totalSubIBs,
    });
  };

  const hasSubIBs = formData.tiene_sub_ibs && formData.sub_ibs.length > 0;
  const ibRemainder = formData.dolares_ib_restante;
  const isOverAllocated = ibRemainder !== null && ibRemainder < 0;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Modelo Rebates</h3>
      </div>

      <SpreadTable readOnly={formData.usar_spreads_default} />

      <div>
        <Label className="text-sm font-semibold">¿Desea mantener los valores de Dólares IB por defecto?</Label>
        <RadioGroup
          value={formData.usar_spreads_default ? "si" : "no"}
          onValueChange={(v) => {
            const useDefault = v === "si";
            updateFormData({ usar_spreads_default: useDefault });
            if (useDefault) {
              const config = formData.spread_config.map((s) => ({
                ...s,
                nuevo_dolar_ib: null,
                diferencia: 0,
                nuevo_spread_cliente: s.spread_estandar,
              }));
              updateFormData({
                spread_config: config,
                nuevo_dolar_ib_global: null,
                sub_ib_rebate_allocations: [],
                dolares_ib_restante: null,
              });
            }
          }}
          className="flex gap-4 mt-2"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.usar_spreads_default : !formData.usar_spreads_default)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`spread-default-${val}`} />
              <Label htmlFor={`spread-default-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí, mantener" : "Cambiar"}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {!formData.usar_spreads_default && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nuevo_dolar_ib">Nuevo valor de Dólares IB por lote (aplicar a todos)</Label>
            <Input
              id="nuevo_dolar_ib"
              type="number"
              step="0.5"
              value={formData.nuevo_dolar_ib_global ?? ""}
              onChange={(e) => handleGlobalChange(e.target.value)}
              placeholder="Ej: 10"
              className="max-w-[200px]"
            />
          </div>

          {hasSubIBs && formData.nuevo_dolar_ib_global !== null && formData.nuevo_dolar_ib_global > 0 && (
            <div className="space-y-4 rounded-lg border border-border p-4 bg-secondary/30">
              <div>
                <h4 className="text-sm font-display font-bold text-foreground">Distribución de Dólares por Lote</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Asigna cuántos dólares por lote le corresponden a cada Sub IB / Master IB. El resto queda para el IB principal (Master IB1).
                </p>
              </div>

              <div className="space-y-3">
                {formData.sub_ib_rebate_allocations.map((alloc, index) => {
                  const subIB = formData.sub_ibs[index];
                  const isMaster = subIB?.es_master_ib;
                  const masterNum = subIB?.master_ib_numero;
                  const displayName = isMaster
                    ? `Master IB${masterNum} — ${alloc.nombre || `Sub IB ${index + 1}`}`
                    : alloc.nombre || `Sub IB ${index + 1}`;

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-4 rounded-md p-2 ${isMaster ? 'border border-amber-500/30 bg-amber-500/5' : ''}`}
                    >
                      <div className="flex-1 flex items-center gap-2">
                        {isMaster && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                        <div>
                          <span className={`text-sm font-semibold ${isMaster ? 'text-amber-300' : 'text-foreground'}`}>
                            {displayName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">({alloc.correo})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">USD/lote:</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max={formData.nuevo_dolar_ib_global ?? 0}
                          value={alloc.dolares_asignados || ""}
                          onChange={(e) => handleSubIBAllocation(index, e.target.value)}
                          className={`w-24 ${isMaster ? 'border-amber-500/30' : ''}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total dólares por lote:</span>
                  <span className="font-semibold">${formData.nuevo_dolar_ib_global}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Asignado a Sub IBs / Masters:</span>
                  <span className="font-semibold">
                    ${formData.sub_ib_rebate_allocations.reduce((sum, a) => sum + a.dolares_asignados, 0)}
                  </span>
                </div>
                <div className={`flex justify-between text-sm font-bold ${isOverAllocated ? 'text-destructive' : 'text-primary'}`}>
                  <span>Restante para Master IB1 (Principal):</span>
                  <span>${ibRemainder ?? 0}</span>
                </div>
                {isOverAllocated && (
                  <p className="text-xs text-destructive mt-1">
                    ⚠️ La suma asignada excede el total de dólares por lote.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepRebates;
