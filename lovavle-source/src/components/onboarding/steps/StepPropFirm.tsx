import { useEffect } from "react";
import { useOnboardingStore, PropFirmConfig, PropFirmNivel } from "@/stores/onboardingStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import IBContextBanner from "../IBContextBanner";

const StepPropFirm = () => {
  const { formData, updateFormData } = useOnboardingStore();

  const { data: refComisiones } = useQuery({
    queryKey: ["ref_propfirm_comisiones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_propfirm_comisiones").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (refComisiones && formData.propfirm_config.length === 0) {
      const config: PropFirmConfig[] = refComisiones.map((c) => ({
        rango_ventas: c.rango_ventas,
        porcentaje_comision: c.porcentaje_comision,
        niveles: [{ nivel: 1, porcentaje: c.porcentaje_comision }],
      }));
      updateFormData({ propfirm_config: config });
    }
  }, [refComisiones]);

  const updateComision = (index: number, value: number) => {
    const updated = [...formData.propfirm_config];
    updated[index] = {
      ...updated[index],
      porcentaje_comision: value,
      niveles: [{ nivel: 1, porcentaje: value }],
    };
    updateFormData({ propfirm_config: updated });
  };

  const addNivel = (configIndex: number) => {
    const updated = [...formData.propfirm_config];
    const niveles = [...updated[configIndex].niveles];
    niveles.push({ nivel: niveles.length + 1, porcentaje: 0 });
    updated[configIndex] = { ...updated[configIndex], niveles };
    updateFormData({ propfirm_config: updated });
  };

  const removeNivel = (configIndex: number, nivelIndex: number) => {
    const updated = [...formData.propfirm_config];
    const niveles = updated[configIndex].niveles
      .filter((_, i) => i !== nivelIndex)
      .map((n, i) => ({ ...n, nivel: i + 1 }));
    updated[configIndex] = { ...updated[configIndex], niveles };
    updateFormData({ propfirm_config: updated });
  };

  const updateNivel = (configIndex: number, nivelIndex: number, porcentaje: number) => {
    const updated = [...formData.propfirm_config];
    const niveles = [...updated[configIndex].niveles];
    niveles[nivelIndex] = { ...niveles[nivelIndex], porcentaje };
    updated[configIndex] = { ...updated[configIndex], niveles };
    updateFormData({ propfirm_config: updated });
  };

  const getSumaNiveles = (config: PropFirmConfig) =>
    config.niveles.reduce((sum, n) => sum + n.porcentaje, 0);

  const isNivelesValid = (config: PropFirmConfig) => {
    const suma = getSumaNiveles(config);
    return Math.abs(suma - config.porcentaje_comision) < 0.01;
  };

  const isNiveles = formData.propfirm_cobro_tipo === "niveles";

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">PropFirm</h3>
        <p className="text-sm text-muted-foreground mt-1">Comisiones por ventas de cuentas de fondeo</p>
      </div>

      {/* Tipo de cobro */}
      <div>
        <Label className="text-sm font-semibold">¿Cómo se va a cobrar la comisión?</Label>
        <RadioGroup
          value={formData.propfirm_cobro_tipo || "directo"}
          onValueChange={(v) => updateFormData({ propfirm_cobro_tipo: v as 'directo' | 'niveles' })}
          className="flex gap-4 mt-2"
        >
          {[
            { val: "directo", label: "Directo", desc: "Comisión completa al IB" },
            { val: "niveles", label: "Por Niveles", desc: "Dividida entre niveles de referido" },
          ].map((opt) => (
            <div
              key={opt.val}
              className={`flex items-center space-x-2 rounded-lg border p-3 flex-1 cursor-pointer transition-all ${
                formData.propfirm_cobro_tipo === opt.val
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={opt.val} id={`cobro-${opt.val}`} />
              <div>
                <Label htmlFor={`cobro-${opt.val}`} className="cursor-pointer text-sm font-medium">
                  {opt.label}
                </Label>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Tabla de comisiones */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-xs">Rango de Ventas</TableHead>
              <TableHead className="text-xs text-right">Comisión (%)</TableHead>
              {isNiveles && <TableHead className="text-xs text-right">Niveles</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.propfirm_config.map((c, i) => (
              <TableRow key={i} className="align-top">
                <TableCell className="text-sm">{c.rango_ventas}</TableCell>
                <TableCell className="text-right">
                  {!formData.usar_propfirm_default ? (
                    <Input
                      type="number"
                      value={c.porcentaje_comision}
                      onChange={(e) => updateComision(i, parseFloat(e.target.value) || 0)}
                      className="w-28 ml-auto text-right"
                    />
                  ) : (
                    <span className="font-semibold">{c.porcentaje_comision}%</span>
                  )}
                </TableCell>
                {isNiveles && (
                  <TableCell>
                    <div className="space-y-2">
                      {c.niveles.map((n, ni) => (
                        <div key={ni} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Nivel {n.nivel}:
                          </span>
                          <Input
                            type="number"
                            step="0.1"
                            value={n.porcentaje}
                            onChange={(e) => updateNivel(i, ni, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right text-xs"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          {c.niveles.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeNivel(i, ni)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => addNivel(i)}
                      >
                        <Plus className="h-3 w-3" />
                        Nivel
                      </Button>
                      {/* Suma validation */}
                      <div className={`flex items-center gap-1 text-xs ${isNivelesValid(c) ? 'text-green-400' : 'text-destructive'}`}>
                        {isNivelesValid(c) ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        Suma: {getSumaNiveles(c)}% / {c.porcentaje_comision}%
                      </div>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Label className="text-sm font-semibold">¿Mantener valores por defecto?</Label>
        <RadioGroup
          value={formData.usar_propfirm_default ? "si" : "no"}
          onValueChange={(v) => {
            const useDefault = v === "si";
            updateFormData({ usar_propfirm_default: useDefault });
            if (useDefault && refComisiones) {
              updateFormData({
                propfirm_config: refComisiones.map((c) => ({
                  rango_ventas: c.rango_ventas,
                  porcentaje_comision: c.porcentaje_comision,
                  niveles: [{ nivel: 1, porcentaje: c.porcentaje_comision }],
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
                (val === "si" ? formData.usar_propfirm_default : !formData.usar_propfirm_default)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value={val} id={`pf-default-${val}`} />
              <Label htmlFor={`pf-default-${val}`} className="cursor-pointer text-sm">
                {val === "si" ? "Sí, mantener" : "Cambiar"}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
};

export default StepPropFirm;
