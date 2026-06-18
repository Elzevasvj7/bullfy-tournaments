import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign, AlertTriangle } from "lucide-react";
import type { SubIBFormData } from "../SubIBWizard";
import { DEFAULT_BROKER_GAIN } from "@/hooks/useBrokerPropSettings";

interface Props {
  formData: SubIBFormData;
  updateForm: (data: Partial<SubIBFormData>) => void;
}

const StepSubIBCompensation = ({ formData, updateForm }: Props) => {
  const master = formData.masterFormData;
  if (!master) return <p className="text-muted-foreground">Carga de datos del Master IB pendiente...</p>;

  const showBrokeraje = master.modelo_negocio === "Brokeraje" || master.modelo_negocio === "Ambos";
  const showPropFirm = master.modelo_negocio === "PropFirm" || master.modelo_negocio === "Ambos";
  const isRebates = showBrokeraje && master.tipo_acuerdo_brokeraje === "Rebates";
  const isCPA = showBrokeraje && master.tipo_acuerdo_brokeraje === "CPA";
  const isHybrid = showBrokeraje && master.tipo_acuerdo_brokeraje === "Híbrido";

  // Get master's $/lote
  const masterDolarLote = master.nuevo_dolar_ib_global ?? (master.spread_config[0]?.dolares_ib_original ?? 7);
  const masterHybridLote = master.hybrid_nuevo_dolar_lote ?? DEFAULT_BROKER_GAIN;

  const rebateRemaining = masterDolarLote - formData.dolares_por_lote_sub_ib;
  const hybridLoteRemaining = masterHybridLote - formData.hybrid_lote_sub_ib;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Configuración de Compensación
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define cuánto de la compensación del Master IB se asigna al Sub IB <strong>{formData.nombre || "nuevo"}</strong>
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-sm">
        <span className="text-muted-foreground">Master IB:</span>
        <span className="font-semibold">{formData.master_ib?.nombre_ib}</span>
        <Badge variant="outline" className="text-[10px]">{master.modelo_negocio}</Badge>
        {master.tipo_acuerdo_brokeraje && <Badge variant="secondary" className="text-[10px]">{master.tipo_acuerdo_brokeraje}</Badge>}
      </div>

      {/* Rebates: $/Lote allocation */}
      {isRebates && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Distribución Rebates ($/Lote)</h4>
          <p className="text-xs text-muted-foreground">
            El Master IB tiene <strong>${masterDolarLote}/lote</strong>. Define cuánto se le asigna al Sub IB.
          </p>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs">$/Lote para Sub IB</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max={masterDolarLote}
                value={formData.dolares_por_lote_sub_ib || ""}
                onChange={(e) => updateForm({ dolares_por_lote_sub_ib: parseFloat(e.target.value) || 0 })}
                className="w-32"
                placeholder="0"
              />
            </div>
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">Total Master: <strong className="text-foreground">${masterDolarLote}</strong></div>
              <div className={`font-semibold ${rebateRemaining < 0 ? "text-destructive" : "text-primary"}`}>
                Restante Master: ${rebateRemaining}
              </div>
            </div>
          </div>
          {rebateRemaining < 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              La asignación excede el total del Master IB
            </div>
          )}
        </div>
      )}

      {/* CPA: Per-range allocation */}
      {isCPA && master.cpa_config.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Distribución CPA</h4>
          <p className="text-xs text-muted-foreground">
            Define cuántos dólares del CPA del Master se asignan al Sub IB por cada rango.
          </p>
          <div className="space-y-3">
            {master.cpa_config.map((c, i) => {
              const allocated = formData.cpa_allocation[i]?.dolares_asignados ?? 0;
              const remaining = c.cpa_pagar - allocated;
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-36">{c.rango_deposito}</span>
                  <span className="text-xs font-semibold w-16">${c.cpa_pagar}</span>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max={c.cpa_pagar}
                    value={allocated || ""}
                    onChange={(e) => {
                      const updated = [...formData.cpa_allocation];
                      updated[i] = { ...updated[i], dolares_asignados: parseFloat(e.target.value) || 0 };
                      updateForm({ cpa_allocation: updated });
                    }}
                    className="w-24"
                    placeholder="0"
                  />
                  <span className={`text-xs font-semibold ${remaining < 0 ? "text-destructive" : "text-primary"}`}>
                    Rest: ${remaining}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hybrid */}
      {isHybrid && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Distribución Híbrida</h4>

          {/* Lote portion */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              $/Lote del Master: <strong>${masterHybridLote}</strong>
            </p>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">$/Lote Sub IB</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max={masterHybridLote}
                  value={formData.hybrid_lote_sub_ib || ""}
                  onChange={(e) => updateForm({ hybrid_lote_sub_ib: parseFloat(e.target.value) || 0 })}
                  className="w-32"
                  placeholder="0"
                />
              </div>
              <span className={`text-sm font-semibold ${hybridLoteRemaining < 0 ? "text-destructive" : "text-primary"}`}>
                Rest: ${hybridLoteRemaining}
              </span>
            </div>
          </div>

          {/* CPA portion */}
          {master.hybrid_config.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">CPA por rango:</p>
              {master.hybrid_config.map((h, i) => {
                const allocated = formData.hybrid_cpa_allocation[i]?.dolares_asignados ?? 0;
                const remaining = h.cpa_pagar - allocated;
                return (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-36">{h.rango_deposito}</span>
                    <span className="text-xs font-semibold w-16">${h.cpa_pagar}</span>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max={h.cpa_pagar}
                      value={allocated || ""}
                      onChange={(e) => {
                        const updated = [...formData.hybrid_cpa_allocation];
                        updated[i] = { ...updated[i], dolares_asignados: parseFloat(e.target.value) || 0 };
                        updateForm({ hybrid_cpa_allocation: updated });
                      }}
                      className="w-24"
                      placeholder="0"
                    />
                    <span className={`text-xs font-semibold ${remaining < 0 ? "text-destructive" : "text-primary"}`}>
                      Rest: ${remaining}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PropFirm */}
      {showPropFirm && master.propfirm_config.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Distribución PropFirm</h4>

          {master.propfirm_cobro_tipo === "niveles" ? (
            <>
              <p className="text-xs text-muted-foreground">
                El Master IB tiene distribución por niveles. El Sub IB participará en los niveles configurados.
              </p>
              {master.propfirm_config.map((p, i) => (
                <div key={i} className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">{p.rango_ventas} — {p.porcentaje_comision}%</span>
                  <div className="ml-3 space-y-1">
                    {p.niveles.map((n, ni) => (
                      <div key={ni} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Nivel {n.nivel}:</span>
                        <span className="font-semibold text-foreground">{n.porcentaje}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="space-y-2">
                {master.propfirm_config.map((p, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    {p.rango_ventas}: <strong>{p.porcentaje_comision}%</strong> (Directo al Master IB)
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">El Sub IB no recibirá comisión PropFirm</p>
                  <p className="mt-0.5 text-muted-foreground">
                    La distribución del Master IB es directa (sin niveles). Si desea que el Sub IB participe en las comisiones PropFirm, debe contactar a su Master IB para configurar niveles.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StepSubIBCompensation;
