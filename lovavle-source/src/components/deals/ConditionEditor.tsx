import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, TrendingUp, DollarSign, Layers, Building2, Plus, Trash2 } from "lucide-react";
import { loadIBFormData } from "@/services/loadIBFormData";
import { updateIBConditions } from "@/services/updateIBConditions";
import type { OnboardingFormData, SpreadConfig, CPAConfig, HybridConfig, PropFirmConfig } from "@/stores/onboardingStore";
import { calculateRebateClientSpread } from "@/lib/spreadCalculations";

interface ConditionEditorProps {
  open: boolean;
  onClose: () => void;
  ibId: string;
  ibName: string;
  modeloNegocio: string;
  tipoAcuerdo: string | null;
  onSaved: () => void;
}

const ConditionEditor = ({ open, onClose, ibId, ibName, modeloNegocio, tipoAcuerdo, onSaved }: ConditionEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormData | null>(null);

  useEffect(() => {
    if (open && ibId) {
      setLoading(true);
      loadIBFormData(ibId)
        .then((data) => setFormData(data))
        .catch((err) => toast({ title: "Error", description: err.message, variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [open, ibId]);

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      const result = await updateIBConditions(ibId, formData);
      toast({
        title: "✅ Condiciones actualizadas",
        description: `Versión ${result.version} guardada. ${result.reportCount} reportes generados.`,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSpread = (index: number, field: keyof SpreadConfig, value: number | null) => {
    if (!formData) return;
    const updated = [...formData.spread_config];
    updated[index] = { ...updated[index], [field]: value };
    // Recalculate derived fields
    if (field === "nuevo_dolar_ib" && value !== null) {
      const s = updated[index];
      const { diff, nuevoSpread } = calculateRebateClientSpread(s, value);
      updated[index].diferencia = diff;
      updated[index].nuevo_spread_cliente = nuevoSpread;
    }
    setFormData({ ...formData, spread_config: updated });
  };

  const updateCPA = (index: number, field: keyof CPAConfig, value: number | string) => {
    if (!formData) return;
    const updated = [...formData.cpa_config];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, cpa_config: updated });
  };

  const addCPARow = () => {
    if (!formData) return;
    setFormData({ ...formData, cpa_config: [...formData.cpa_config, { rango_deposito: "", cpa_pagar: 0 }] });
  };

  const removeCPARow = (index: number) => {
    if (!formData) return;
    setFormData({ ...formData, cpa_config: formData.cpa_config.filter((_, i) => i !== index) });
  };

  const updateHybrid = (index: number, field: keyof HybridConfig, value: number | string) => {
    if (!formData) return;
    const updated = [...formData.hybrid_config];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, hybrid_config: updated });
  };

  const addHybridRow = () => {
    if (!formData) return;
    setFormData({ ...formData, hybrid_config: [...formData.hybrid_config, { rango_deposito: "", cpa_pagar: 0, dolares_por_lote: 0 }] });
  };

  const removeHybridRow = (index: number) => {
    if (!formData) return;
    setFormData({ ...formData, hybrid_config: formData.hybrid_config.filter((_, i) => i !== index) });
  };

  const updatePropfirm = (index: number, field: keyof PropFirmConfig, value: number | string) => {
    if (!formData) return;
    const updated = [...formData.propfirm_config];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, propfirm_config: updated });
  };

  const addPropfirmRow = () => {
    if (!formData) return;
    setFormData({ ...formData, propfirm_config: [...formData.propfirm_config, { rango_ventas: "", porcentaje_comision: 0, niveles: [] }] });
  };

  const removePropfirmRow = (index: number) => {
    if (!formData) return;
    setFormData({ ...formData, propfirm_config: formData.propfirm_config.filter((_, i) => i !== index) });
  };

  const hasBrokeraje = modeloNegocio === "Brokeraje" || modeloNegocio === "Ambos";
  const hasPropFirm = modeloNegocio === "PropFirm" || modeloNegocio === "Ambos";
  const hasRebates = tipoAcuerdo === "Rebates" || tipoAcuerdo === "Híbrido";
  const hasCPA = tipoAcuerdo === "CPA";
  const hasHybrid = tipoAcuerdo === "Híbrido";

  const getDefaultTab = () => {
    if (hasRebates) return "spreads";
    if (hasCPA) return "cpa";
    if (hasPropFirm) return "propfirm";
    return "spreads";
  };

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Modificar Condiciones
            <Badge variant="secondary" className="text-xs">{ibName}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración...
          </div>
        ) : formData ? (
          <Tabs defaultValue={getDefaultTab()} className="w-full">
            <TabsList className="w-full bg-secondary/50 border border-border">
              {hasRebates && (
                <TabsTrigger value="spreads" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <TrendingUp className="w-3.5 h-3.5" /> Spreads
                </TabsTrigger>
              )}
              {hasCPA && (
                <TabsTrigger value="cpa" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <DollarSign className="w-3.5 h-3.5" /> CPA
                </TabsTrigger>
              )}
              {hasHybrid && (
                <TabsTrigger value="hybrid" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Layers className="w-3.5 h-3.5" /> Híbrido
                </TabsTrigger>
              )}
              {hasPropFirm && (
                <TabsTrigger value="propfirm" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Building2 className="w-3.5 h-3.5" /> PropFirm
                </TabsTrigger>
              )}
            </TabsList>

            {/* Spreads Tab */}
            {hasRebates && (
              <TabsContent value="spreads" className="space-y-3 mt-4">
                <p className="text-xs text-muted-foreground">Modifica los dólares por lote para cada instrumento.</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/30 border-b border-border">
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium">Símbolo</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium">Raw</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium">Estándar</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium">$/Lote Original</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium">Nuevo $/Lote</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {formData.spread_config.map((s, i) => (
                        <tr key={i} className="hover:bg-secondary/10">
                          <td className="px-3 py-2 font-mono uppercase font-medium text-foreground">{s.symbol}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.raw}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.spread_estandar}</td>
                          <td className="px-3 py-2 text-muted-foreground">${s.dolares_ib_original}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={s.nuevo_dolar_ib ?? ""}
                              onChange={(e) => updateSpread(i, "nuevo_dolar_ib", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 w-20 text-xs"
                              step="0.5"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}

            {/* CPA Tab */}
            {hasCPA && (
              <TabsContent value="cpa" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Configura rangos de depósito y CPA a pagar.</p>
                  <Button variant="ghost" size="sm" onClick={addCPARow} className="gap-1 text-xs h-7">
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.cpa_config.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Rango Depósito</Label>
                        <Input
                          value={c.rango_deposito}
                          onChange={(e) => updateCPA(i, "rango_deposito", e.target.value)}
                          className="h-7 text-xs"
                          placeholder="ej: $200-$499"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs text-muted-foreground">CPA ($)</Label>
                        <Input
                          type="number"
                          value={c.cpa_pagar}
                          onChange={(e) => updateCPA(i, "cpa_pagar", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeCPARow(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive mt-5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Hybrid Tab */}
            {hasHybrid && (
              <TabsContent value="hybrid" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Configura CPA + dólares por lote por rango.</p>
                  <Button variant="ghost" size="sm" onClick={addHybridRow} className="gap-1 text-xs h-7">
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.hybrid_config.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Rango Depósito</Label>
                        <Input
                          value={h.rango_deposito}
                          onChange={(e) => updateHybrid(i, "rango_deposito", e.target.value)}
                          className="h-7 text-xs"
                          placeholder="ej: $200-$499"
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs text-muted-foreground">CPA ($)</Label>
                        <Input
                          type="number"
                          value={h.cpa_pagar}
                          onChange={(e) => updateHybrid(i, "cpa_pagar", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs text-muted-foreground">$/Lote</Label>
                        <Input
                          type="number"
                          value={h.dolares_por_lote}
                          onChange={(e) => updateHybrid(i, "dolares_por_lote", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeHybridRow(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive mt-5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* PropFirm Tab */}
            {hasPropFirm && (
              <TabsContent value="propfirm" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Configura rangos de ventas y porcentaje de comisión.</p>
                  <Button variant="ghost" size="sm" onClick={addPropfirmRow} className="gap-1 text-xs h-7">
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.propfirm_config.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Rango Ventas</Label>
                        <Input
                          value={p.rango_ventas}
                          onChange={(e) => updatePropfirm(i, "rango_ventas", e.target.value)}
                          className="h-7 text-xs"
                          placeholder="ej: 1-10 ventas"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs text-muted-foreground">Comisión (%)</Label>
                        <Input
                          type="number"
                          value={p.porcentaje_comision}
                          onChange={(e) => updatePropfirm(i, "porcentaje_comision", Number(e.target.value))}
                          className="h-7 text-xs"
                          step="0.5"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePropfirmRow(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive mt-5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <p className="text-sm text-destructive py-6 text-center">No se pudo cargar la configuración</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || !formData} className="bg-gradient-gold text-primary-foreground gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar y generar reportes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConditionEditor;
