import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings2, BarChart3, UserCheck, Brain, Wrench, Briefcase, FileBarChart, LayoutGrid, User as UserIcon, Link2, Workflow, ShieldCheck, TrendingUp, Webhook } from "lucide-react";
import LeadKanban from "./LeadKanban";
import PipelineConfig from "./PipelineConfig";
import LeadScoring from "./LeadScoring";
import SalesAgentPanel from "./SalesAgentPanel";
import SupervisorPanel from "./SupervisorPanel";
import SmartCallDashboard from "./SmartCallDashboard";
import LeadSystemConfig from "./LeadSystemConfig";
import BDProspectKanban from "./BDProspectKanban";
import LeadReports from "./LeadReports";
import CommunityDashboard from "./dashboard/CommunityDashboard";
import MyLeadsByCommunity from "./my-leads/MyLeadsByCommunity";
import CloserCommunityAssignmentsPanel from "./admin/CloserCommunityAssignmentsPanel";
import AssignmentsPanel from "./admin/AssignmentsPanel";
import NurturingPanel from "./admin/NurturingPanel";
import SLAPanel from "./admin/SLAPanel";
import MetricsPanel from "./admin/MetricsPanel";
import WebhooksPanel from "./admin/WebhooksPanel";
import { useAuth } from "@/hooks/useAuth";
import { BrowserCallProvider } from "@/hooks/useBrowserCall";

const LeadSystemDashboardInner = () => {
  const [tab, setTab] = useState("dashboard");
  const { isAdmin, isGlobalAdmin, roles } = useAuth();
  const isAdminVentas = roles.includes("admin_ventas");
  const isVentas = roles.includes("ventas");
  const isBD = roles.includes("bd");
  const canConfigure = isAdmin || isGlobalAdmin || isAdminVentas;
  const canSystemConfig = isAdmin || isGlobalAdmin;
  const canCall = isAdmin || isGlobalAdmin || isAdminVentas || isVentas || isBD;
  const canSeeProspectsIB = isBD || isAdmin || isGlobalAdmin;
  const canSeeClassicKanban = isAdmin || isGlobalAdmin || isAdminVentas;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Bullfy Lead System</h2>
          <p className="text-sm text-muted-foreground">Dashboard comercial por comunidades / streamers</p>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto">
              <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <LayoutGrid className="w-4 h-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="my-leads" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <UserIcon className="w-4 h-4" /> Mis Leads
              </TabsTrigger>
              {canSeeClassicKanban && (
                <TabsTrigger value="leads" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Users className="w-4 h-4" /> Kanban
                </TabsTrigger>
              )}
              <TabsTrigger value="scoring" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <BarChart3 className="w-4 h-4" /> Scoring
              </TabsTrigger>
              {canConfigure && (
                <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <FileBarChart className="w-4 h-4" /> Reportes
                </TabsTrigger>
              )}
              {canSeeProspectsIB && (
                <TabsTrigger value="prospects-ib" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Briefcase className="w-4 h-4" /> Prospectos IB
                </TabsTrigger>
              )}
              {isAdminVentas && (
                <TabsTrigger value="supervisor" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <UserCheck className="w-4 h-4" /> Supervisor
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="assignments" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Link2 className="w-4 h-4" /> Asignar comunidades
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="queue" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <UserCheck className="w-4 h-4" /> Cola asignación
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="nurturing" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Workflow className="w-4 h-4" /> Nurturing
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="sla" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <ShieldCheck className="w-4 h-4" /> SLA
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="metrics" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <TrendingUp className="w-4 h-4" /> Métricas
                </TabsTrigger>
              )}
              {canSystemConfig && (
                <TabsTrigger value="webhooks" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Webhook className="w-4 h-4" /> Webhooks
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="smart-call" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Brain className="w-4 h-4" /> Smart Call
                </TabsTrigger>
              )}
              {canConfigure && (
                <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Settings2 className="w-4 h-4" /> Pipeline
                </TabsTrigger>
              )}
              {canSystemConfig && (
                <TabsTrigger value="system-config" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Wrench className="w-4 h-4" /> Configuración
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="dashboard"><CommunityDashboard /></TabsContent>
            <TabsContent value="my-leads"><MyLeadsByCommunity /></TabsContent>
            {canSeeClassicKanban && <TabsContent value="leads"><LeadKanban /></TabsContent>}
            <TabsContent value="scoring"><LeadScoring /></TabsContent>
            {canConfigure && <TabsContent value="reports"><LeadReports /></TabsContent>}
            {canSeeProspectsIB && <TabsContent value="prospects-ib"><BDProspectKanban /></TabsContent>}
            {isAdminVentas && <TabsContent value="supervisor"><SupervisorPanel /></TabsContent>}
            {canConfigure && <TabsContent value="assignments"><CloserCommunityAssignmentsPanel /></TabsContent>}
            {canConfigure && <TabsContent value="queue"><AssignmentsPanel /></TabsContent>}
            {canConfigure && <TabsContent value="nurturing"><NurturingPanel /></TabsContent>}
            {canConfigure && <TabsContent value="sla"><SLAPanel /></TabsContent>}
            {canConfigure && <TabsContent value="metrics"><MetricsPanel /></TabsContent>}
            {canSystemConfig && <TabsContent value="webhooks"><WebhooksPanel /></TabsContent>}
            {canConfigure && <TabsContent value="smart-call"><SmartCallDashboard /></TabsContent>}
            {canConfigure && <TabsContent value="config"><PipelineConfig /></TabsContent>}
            {canSystemConfig && <TabsContent value="system-config"><LeadSystemConfig /></TabsContent>}
          </Tabs>
        </div>

        {canCall && (tab === "dashboard" || tab === "my-leads" || tab === "leads" || tab === "supervisor") && (
          <div className="w-64 flex-shrink-0">
            <SalesAgentPanel />
          </div>
        )}
      </div>
    </div>
  );
};

const LeadSystemDashboard = () => (
  <BrowserCallProvider>
    <LeadSystemDashboardInner />
  </BrowserCallProvider>
);

export default LeadSystemDashboard;
