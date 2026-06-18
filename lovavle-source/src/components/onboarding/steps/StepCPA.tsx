import { useEffect } from "react";
import { useOnboardingStore, CPAConfig, CPARangoAsignacion } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import IBContextBanner from "../IBContextBanner";
import SpreadTable from "../SpreadTable";

const StepCPA = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const { data: refCPA } = useQuery({
    queryKey: ["ref_cpa_latam"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_cpa_latam").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (refCPA && formData.cpa_config.length === 0) {
      const config: CPAConfig[] = refCPA.map((c) => ({
        rango_deposito: c.rango_deposito,
        cpa_pagar: c.cpa_pagar,
      }));
      updateFormData({ cpa_config: config });
    }
  }, [refCPA]);

  const updateCPA = (index: number, value: number) => {
    const updated = [...formData.cpa_config];
    updated[index] = { ...updated[index], cpa_pagar: value };
    updateFormData({ cpa_config: updated });
  };

  // Build empty asignaciones from current CPA config ranges
  const buildEmptyAsignaciones = (): CPARangoAsignacion[] =>
    formData.cpa_config.map((c) => ({ rango_deposito: c.rango_deposito, dolares_asignados: 0 }));

  const addDistribution = () => {
    updateFormData({
      cpa_distribution: [
        ...formData.cpa_distribution,
        { nombre: "", correo: "", asignaciones: buildEmptyAsignaciones(), es_sub_ib: false },
      ],
    });
  };

  const removeDistribution = (index: number) => {
    updateFormData({
      cpa_distribution: formData.cpa_distribution.filter((_, i) => i !== index),
    });
  };

  const updateDistributionField = (index: number, field: "nombre" | "correo", value: string) => {
    const updated = [...formData.cpa_distribution];
    updated[index] = { ...updated[index], [field]: value };
    updateFormData({ cpa_distribution: updated });
  };

  const updateDistributionAmount = (distIndex: number, rangoIndex: number, value: number) => {
    const updated = [...formData.cpa_distribution];
    const asignaciones = [...updated[distIndex].asignaciones];
    asignaciones[rangoIndex] = { ...asignaciones[rangoIndex], dolares_asignados: value };
    updated[distIndex] = { ...updated[distIndex], asignaciones };
    updateFormData({ cpa_distribution: updated });
  };

  const autoFillSubIBs = () => {
    const subIBEntries = formData.sub_ibs.map((sub) => ({
      nombre: sub.nombre,
      correo: sub.correo,
      asignaciones: buildEmptyAsignaciones(),
      es_sub_ib: true,
    }));
    updateFormData({ cpa_distribution: [...formData.cpa_distribution, ...subIBEntries] });
  };

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Modelo CPA</h3>
        <p className="text-sm text-muted-foreground mt-1">Configuración de CPA por rango de depósito</p>
      </div>

      <SpreadTable readOnly />

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-xs">Rango de Depósito</TableHead>
              <TableHead className="text-xs text-right">CPA a Pagar ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.cpa_config.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{c.rango_deposito}</TableCell>
                <TableCell className="text-right">
                  {!formData.usar_cpa_default ? (
                    <Input
                      type="number"
                      value={c.cpa_pagar}
                      onChange={(e) => updateCPA(i, parseFloat(e.target.value) || 0)}
                      className="w-28 ml-auto text-right"
                    />
                  ) : (
                    <span className="font-semibold">${c.cpa_pagar}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Label className="text-sm font-semibold">¿Desea mantener los valores CPA por defecto?</Label>
        <RadioGroup
          value={formData.usar_cpa_default ? "si" : "no"}
          onValueChange={(v) => {
            const useDefault = v === "si";
            updateFormData({ usar_cpa_default: useDefault });
            if (useDefault && refCPA) {
              updateFormData({
                cpa_config: refCPA.map((c) => ({
                  rango_deposito: c.rango_deposito,
                  cpa_pagar: c.cpa_pagar,
                })),
              });
            }
          }}
          className="flex gap-4 mt-2"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.usar_cpa_default : !formData.usar_cpa_default)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`cpa-default-${val}`} />
              <Label htmlFor={`cpa-default-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí, mantener" : "Cambiar"}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* CPA Distribution */}
      <div className="border-t border-border pt-6">
        <h4 className="text-md font-display font-bold text-foreground">Distribución de CPA</h4>
        <p className="text-sm text-muted-foreground mt-1">¿Desea repartir el CPA con otros usuarios?</p>

        <RadioGroup
          value={formData.repartir_cpa ? "si" : "no"}
          onValueChange={(v) => updateFormData({ repartir_cpa: v === "si" })}
          className="flex gap-4 mt-3"
        >
          {["si", "no"].map((val) => (
            <div
              key={val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                (val === "si" ? formData.repartir_cpa : !formData.repartir_cpa)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`repartir-${val}`} />
              <Label htmlFor={`repartir-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí" : "No"}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {formData.repartir_cpa && (
        <div className="space-y-6">
          {formData.tiene_sub_ibs && formData.sub_ibs.length > 0 && (
            <Button variant="outline" size="sm" onClick={autoFillSubIBs}>
              Cargar Sub IBs automáticamente
            </Button>
          )}

          {formData.cpa_distribution.map((dist, index) => (
            <div key={index} className="rounded-lg border border-border p-4 space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={dist.nombre}
                    onChange={(e) => updateDistributionField(index, "nombre", e.target.value)}
                    placeholder="Nombre"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Correo</Label>
                  <Input
                    type="email"
                    value={dist.correo}
                    onChange={(e) => updateDistributionField(index, "correo", e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeDistribution(index)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Per-range assignments */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead className="text-xs">Rango de Depósito</TableHead>
                      <TableHead className="text-xs">CPA Total ($)</TableHead>
                      <TableHead className="text-xs text-right">$ Asignados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dist.asignaciones.map((asig, ri) => {
                      const cpaCfg = formData.cpa_config.find((c) => c.rango_deposito === asig.rango_deposito);
                      return (
                        <TableRow key={ri}>
                          <TableCell className="text-sm">{asig.rango_deposito}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            ${cpaCfg?.cpa_pagar ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={asig.dolares_asignados || ""}
                              onChange={(e) => updateDistributionAmount(index, ri, parseFloat(e.target.value) || 0)}
                              className="w-28 ml-auto text-right"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addDistribution}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar usuario
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepCPA;
