import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import type { SubIBFormData } from "../SubIBWizard";

interface Props {
  formData: SubIBFormData;
}

const StepSubIBSummary = ({ formData }: Props) => {
  const master = formData.masterFormData;
  if (!master) return null;

  const showBrokeraje = master.modelo_negocio === "Brokeraje" || master.modelo_negocio === "Ambos";
  const showPropFirm = master.modelo_negocio === "PropFirm" || master.modelo_negocio === "Ambos";
  const isRebates = showBrokeraje && master.tipo_acuerdo_brokeraje === "Rebates";
  const isCPA = showBrokeraje && master.tipo_acuerdo_brokeraje === "CPA";
  const isHybrid = showBrokeraje && master.tipo_acuerdo_brokeraje === "Híbrido";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          Resumen del Sub IB
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Revisa la información antes de crear</p>
      </div>

      {/* Master IB Info */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Master IB</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Nombre:</span> {formData.master_ib?.nombre_ib}</div>
          <div><span className="text-muted-foreground">BD:</span> {formData.master_ib?.nombre_bd}</div>
          <div><span className="text-muted-foreground">Modelo:</span> {formData.master_ib?.modelo_negocio}</div>
          <div><span className="text-muted-foreground">Región:</span> {formData.master_ib?.lugar_operacion}</div>
        </div>
      </div>

      {/* Sub IB Info */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Nuevo Sub IB</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Nombre:</span> {formData.nombre}</div>
          <div><span className="text-muted-foreground">Correo:</span> {formData.correo}</div>
          <div><span className="text-muted-foreground">ID ({formData.tipo_id}):</span> {formData.id_documento}</div>
        </div>
      </div>

      {/* Compensation */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Compensación Asignada</h4>

        {isRebates && (
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">$/Lote Sub IB:</span>
              <span className="font-semibold">${formData.dolares_por_lote_sub_ib}</span>
            </div>
          </div>
        )}

        {isCPA && formData.cpa_allocation.length > 0 && (
          <div className="text-xs space-y-1">
            {formData.cpa_allocation.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{a.rango_deposito}:</span>
                <span className="font-semibold">${a.dolares_asignados}</span>
              </div>
            ))}
          </div>
        )}

        {isHybrid && (
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">$/Lote Sub IB:</span>
              <span className="font-semibold">${formData.hybrid_lote_sub_ib}</span>
            </div>
            {formData.hybrid_cpa_allocation.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">CPA {a.rango_deposito}:</span>
                <span className="font-semibold">${a.dolares_asignados}</span>
              </div>
            ))}
          </div>
        )}

        {showPropFirm && master.propfirm_config.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">PropFirm:</span>
            {master.propfirm_cobro_tipo === "niveles" ? (
              master.propfirm_config.map((p, i) => (
                <div key={i} className="text-xs text-muted-foreground ml-2">
                  {p.rango_ventas}: {p.niveles.map(n => `Nivel ${n.nivel}: ${n.porcentaje}%`).join(" | ")}
                </div>
              ))
            ) : (
              <div className="text-xs text-destructive ml-2">Sin niveles — Sub IB no recibe comisión PropFirm</div>
            )}
          </div>
        )}
      </div>

      {/* Reports */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">📄 Se generarán los siguientes reportes:</p>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1">
          <li>• IB Agreement (Sub IB)</li>
          <li>• IB Technical Report (Sub IB)</li>
        </ul>
      </div>
    </div>
  );
};

export default StepSubIBSummary;
