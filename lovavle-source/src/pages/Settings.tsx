import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuditLog from "@/components/settings/AuditLog";
import IntegrationSettings from "@/components/settings/IntegrationSettings";
import ApiBalancesPanel from "@/components/settings/ApiBalancesPanel";
import ATFXSettings from "@/components/settings/ATFXSettings";
import ATFXApiTester from "@/components/settings/ATFXApiTester";
import MetaAPISettings from "@/components/settings/MetaAPISettings";
import PaymentGatewaySettings from "@/components/settings/PaymentGatewaySettings";
import NowPaymentsSettings from "@/components/settings/NowPaymentsSettings";
import TradingRoomPlansSettings from "@/components/settings/TradingRoomPlansSettings";
import SandboxGateways from "@/components/settings/SandboxGateways";
import LiveFeatureAccessMatrix from "@/components/admin/LiveFeatureAccessMatrix";
import GoogleCalendarSettings from "@/components/settings/GoogleCalendarSettings";
import BrokerPropSettings from "@/components/settings/BrokerPropSettings";
import EditableReferenceTable, { type ReferenceColumn } from "@/components/settings/EditableReferenceTable";

// ─── Column definitions per table ───
const SPREADS_COLS: ReferenceColumn[] = [
  { key: "symbol", label: "Symbol", type: "text" },
  { key: "raw", label: "RAW", type: "number" },
  { key: "spread_estandar", label: "Spread Estándar", type: "number" },
  { key: "dolares_ib", label: "$/Lote IB", type: "number" },
  { key: "ajuste_manual", label: "Ajuste Manual", type: "number" },
];

const CPA_LATAM_COLS: ReferenceColumn[] = [
  { key: "rango_deposito", label: "Rango Depósito", type: "text" },
  { key: "cpa_pagar", label: "CPA a Pagar ($)", type: "number" },
];

const CPA_HIBRIDO_COLS: ReferenceColumn[] = [
  { key: "rango_deposito", label: "Rango Depósito", type: "text" },
  { key: "cpa_pagar", label: "CPA a Pagar ($)", type: "number" },
  { key: "dolares_por_lote", label: "$/Lote", type: "number" },
];

const PROPFIRM_COM_COLS: ReferenceColumn[] = [
  { key: "rango_ventas", label: "Rango Ventas", type: "text" },
  { key: "porcentaje_comision", label: "Comisión (%)", type: "number" },
];

const PROPFIRM_CUENTAS_COLS: ReferenceColumn[] = [
  { key: "tipo", label: "Tipo", type: "text" },
  { key: "balance", label: "Balance ($)", type: "number" },
  { key: "precio", label: "Precio ($)", type: "number" },
];

const Settings = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Configuración</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tablas de referencia del sistema — Solo administradores
          </p>
        </div>

        <Tabs defaultValue="broker_prop" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="broker_prop">Broker / Prop</TabsTrigger>
            <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
            <TabsTrigger value="saldos_apis">Saldos APIs</TabsTrigger>
            <TabsTrigger value="pasarelas">Pasarelas de Pago</TabsTrigger>
            <TabsTrigger value="sandbox">Sandbox Pasarelas</TabsTrigger>
            <TabsTrigger value="bullfy_live">Bullfy Live</TabsTrigger>
            <TabsTrigger value="google_calendar">Google Calendar</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          </TabsList>

          <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
            <TabsContent value="broker_prop" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-display font-bold text-foreground">Parámetros de Broker/Prop</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configura la ganancia broker y las tablas base usadas por brokeraje y PropFirm.
                </p>
              </div>

              <BrokerPropSettings />

              <Tabs defaultValue="spreads" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="spreads">Spreads</TabsTrigger>
                  <TabsTrigger value="cpa_latam">CPA LATAM</TabsTrigger>
                  <TabsTrigger value="cpa_hibrido">CPA Híbrido</TabsTrigger>
                  <TabsTrigger value="propfirm_com">PropFirm Comisiones</TabsTrigger>
                  <TabsTrigger value="propfirm_cuentas">PropFirm Cuentas</TabsTrigger>
                </TabsList>

                <TabsContent value="spreads" className="mt-0">
                  <EditableReferenceTable tableName="ref_spreads" columns={SPREADS_COLS} />
                </TabsContent>
                <TabsContent value="cpa_latam" className="mt-0">
                  <EditableReferenceTable tableName="ref_cpa_latam" columns={CPA_LATAM_COLS} />
                </TabsContent>
                <TabsContent value="cpa_hibrido" className="mt-0">
                  <EditableReferenceTable tableName="ref_cpa_hibrido" columns={CPA_HIBRIDO_COLS} />
                </TabsContent>
                <TabsContent value="propfirm_com" className="mt-0">
                  <EditableReferenceTable tableName="ref_propfirm_comisiones" columns={PROPFIRM_COM_COLS} />
                </TabsContent>
                <TabsContent value="propfirm_cuentas" className="mt-0">
                  <EditableReferenceTable tableName="ref_propfirm_cuentas" columns={PROPFIRM_CUENTAS_COLS} />
                </TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="integraciones" className="mt-0 space-y-6">
              <IntegrationSettings />
              <MetaAPISettings />
              <ATFXSettings />
              <ATFXApiTester />
            </TabsContent>
            <TabsContent value="saldos_apis" className="mt-0">
              <ApiBalancesPanel />
            </TabsContent>
            <TabsContent value="pasarelas" className="mt-0 space-y-6">
              <PaymentGatewaySettings />
              <NowPaymentsSettings />
            </TabsContent>
            <TabsContent value="sandbox" className="mt-0">
              <SandboxGateways />
            </TabsContent>
            <TabsContent value="bullfy_live" className="mt-0 space-y-8">
              <LiveFeatureAccessMatrix />
              <div className="border-t border-border pt-6">
                <TradingRoomPlansSettings />
              </div>
            </TabsContent>
            <TabsContent value="google_calendar" className="mt-0">
              <GoogleCalendarSettings />
            </TabsContent>
            <TabsContent value="auditoria" className="mt-0">
              <AuditLog />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
