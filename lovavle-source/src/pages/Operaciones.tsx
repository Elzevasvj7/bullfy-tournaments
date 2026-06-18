import DashboardLayout from "@/components/DashboardLayout";
import OpsQueue from "@/components/operations/OpsQueue";
import OpsConfigured from "@/components/operations/OpsConfigured";
import OpsDashboard from "@/components/operations/OpsDashboard";
import OpsRequests from "@/components/operations/OpsRequests";
import OpsEfficiencyReport from "@/components/operations/OpsEfficiencyReport";
import OpsRejected from "@/components/operations/OpsRejected";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

const Operaciones = () => {
  const { isAdmin, isGlobalAdmin, isOperaciones, isAdminOperaciones, isBD, isAdminBD, isDealing } = useAuth();
  const canSeeFullOps = isAdmin || isOperaciones || isAdminOperaciones || isDealing;
  const [activeTab, setActiveTab] = useSessionStorageState(
    "bullfy:operaciones:active-tab",
    "queue",
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Operaciones</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestión de configuración de IBs y métricas operativas</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            {canSeeFullOps && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
            <TabsTrigger value="queue">Cola de trabajo</TabsTrigger>
            {canSeeFullOps && <TabsTrigger value="configured">Completados</TabsTrigger>}
            {canSeeFullOps && <TabsTrigger value="rechazados">Rechazados</TabsTrigger>}
            <TabsTrigger value="solicitudes">Mis Solicitudes</TabsTrigger>
            {isGlobalAdmin && <TabsTrigger value="reportes">Reportes</TabsTrigger>}
          </TabsList>
          {canSeeFullOps && (
            <TabsContent value="dashboard">
              <OpsDashboard />
            </TabsContent>
          )}
          <TabsContent value="queue">
            <OpsQueue />
          </TabsContent>
          {canSeeFullOps && (
            <TabsContent value="configured">
              <OpsConfigured />
            </TabsContent>
          )}
          {canSeeFullOps && (
            <TabsContent value="rechazados">
              <OpsRejected />
            </TabsContent>
          )}
          <TabsContent value="solicitudes">
            <OpsRequests />
          </TabsContent>
          {isGlobalAdmin && (
            <TabsContent value="reportes">
              <OpsEfficiencyReport />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Operaciones;
