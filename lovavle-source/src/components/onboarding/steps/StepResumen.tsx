import { useOnboardingStore } from "@/stores/onboardingStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import IBContextBanner from "../IBContextBanner";

const StepResumen = () => {
  const { formData } = useOnboardingStore();

  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Resumen del Onboarding</h3>
        <p className="text-sm text-muted-foreground mt-1">Revisa toda la información antes de generar los reportes</p>
      </div>

      {/* Info General */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Información General
          <Badge variant="outline" className="text-xs">{formData.lugar_operacion}</Badge>
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">BD:</span> {formData.nombre_bd}</div>
          <div><span className="text-muted-foreground">IB:</span> {formData.nombre_ib}</div>
          <div><span className="text-muted-foreground">Correo:</span> {formData.correo_ib}</div>
          <div><span className="text-muted-foreground">ID ({formData.tipo_id}):</span> {formData.id_ib}</div>
          <div><span className="text-muted-foreground">Tipo:</span> {formData.tipo_persona}</div>
          {formData.tipo_persona === "Empresa" && (
            <>
              {formData.direccion_empresa && <div className="col-span-2"><span className="text-muted-foreground">Dirección:</span> {formData.direccion_empresa}</div>}
              {formData.contacto_corporativo && <div><span className="text-muted-foreground">Contacto Corp.:</span> {formData.contacto_corporativo}</div>}
              {formData.representante_legal && <div><span className="text-muted-foreground">Rep. Legal:</span> {formData.representante_legal}</div>}
              {formData.tipo_id_representante && formData.id_representante && (
                <div><span className="text-muted-foreground">ID Rep. ({formData.tipo_id_representante}):</span> {formData.id_representante}</div>
              )}
            </>
          )}
        </div>
        {formData.negociaciones_especiales?.trim() && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Negociaciones Especiales:</span>
            <p className="text-xs mt-1">{formData.negociaciones_especiales}</p>
          </div>
        )}
      </div>

      {/* Sub IBs */}
      {formData.tiene_sub_ibs && formData.sub_ibs.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            Sub IBs ({formData.sub_ibs.length})
          </h4>
          {formData.sub_ibs.map((sub, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {sub.nombre} — {sub.correo}
            </div>
          ))}
        </div>
      )}

      {/* Modelo de Negocio */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Modelo de Negocio</h4>
        <Badge className="bg-gradient-gold text-primary-foreground">{formData.modelo_negocio}</Badge>
        {showBrokeraje && (
          <Badge variant="outline" className="ml-2">{formData.tipo_acuerdo_brokeraje}</Badge>
        )}
      </div>

      {/* Spreads (if Rebates or Hybrid) */}
      {showBrokeraje && (formData.tipo_acuerdo_brokeraje === "Rebates" || formData.tipo_acuerdo_brokeraje === "Híbrido") && formData.spread_config.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="p-3 bg-secondary">
            <h4 className="text-sm font-semibold text-foreground">Configuración de Spreads</h4>
          </div>
          <div className="max-h-[200px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Símbolo</TableHead>
                  <TableHead className="text-xs text-right">Spread Estándar</TableHead>
                  <TableHead className="text-xs text-right">Nuevo Spread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.spread_config.slice(0, 10).map((s, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="font-mono">{s.symbol}</TableCell>
                    <TableCell className="text-right">{s.spread_estandar}</TableCell>
                    <TableCell className="text-right font-semibold">{s.nuevo_spread_cliente}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {formData.spread_config.length > 10 && (
            <div className="p-2 text-center text-xs text-muted-foreground">
              ... y {formData.spread_config.length - 10} símbolos más
            </div>
          )}
        </div>
      )}

      {/* CPA Config */}
      {showBrokeraje && (formData.tipo_acuerdo_brokeraje === "CPA" || formData.tipo_acuerdo_brokeraje === "Híbrido") && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Configuración CPA</h4>
          <div className="space-y-1">
            {(formData.tipo_acuerdo_brokeraje === "CPA" ? formData.cpa_config : formData.hybrid_config).map((c, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{c.rango_deposito}</span>
                <span className="font-semibold">${c.cpa_pagar}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PropFirm */}
      {showPropFirm && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Comisiones PropFirm</h4>
          {formData.propfirm_config.map((c, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{c.rango_ventas}</span>
              <span className="font-semibold">{c.porcentaje_comision}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Cuentas */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Cuentas</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {formData.cuentas_marketing_tipo && (
            <>
              <div className="text-muted-foreground">Marketing ({formData.cuentas_marketing_tipo}):</div>
              <div>{formData.cuentas_marketing_cantidad} cuentas, ${formData.cuentas_marketing_balance}</div>
            </>
          )}
          {formData.tiene_fondeo_regalo && (
            <>
              <div className="text-muted-foreground">Fondeo Regalo:</div>
              <div>{formData.fondeo_regalo_cantidad} cuentas, ${formData.fondeo_regalo_balance}</div>
            </>
          )}
          {formData.tiene_fondeo_especial && (
            <>
              <div className="text-muted-foreground">Fondeo Especial:</div>
              <div>${formData.fondeo_especial_balance}</div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">📄 Se generarán los siguientes reportes:</p>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1">
          <li>• IB Technical Report for IT Department</li>
          <li>• IB Agreement</li>
          {formData.generar_performance && <li>• IB Performance Report</li>}
        </ul>
      </div>
    </div>
  );
};

export default StepResumen;
