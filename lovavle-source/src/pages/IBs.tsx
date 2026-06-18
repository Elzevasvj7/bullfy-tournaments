import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import IBMaintenance from "@/components/admin/IBMaintenance";
import SpreadCalculator from "@/components/ibs/SpreadCalculator";
import ReportePorBD from "@/components/ibs/ReportePorBD";
import DirectStructurer from "@/components/admin/DirectStructurer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Settings2, Wrench, Building2, BarChart3, FileBarChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const IBs = () => {
  const [activeTab, setActiveTab] = useState("nuevo");
  const { isAdmin, isOperaciones } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">IBs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de Introducing Brokers de Bullfy
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="nuevo" className="gap-1.5">
              <PlusCircle className="w-4 h-4" /> Nuevo Deal
            </TabsTrigger>
            <TabsTrigger value="mantenimiento" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Mantenimiento IBs
            </TabsTrigger>
            <TabsTrigger value="herramientas" className="gap-1.5">
              <Wrench className="w-4 h-4" /> Herramientas IB
            </TabsTrigger>
            <TabsTrigger value="reportes" className="gap-1.5">
              <FileBarChart className="w-4 h-4" /> Reportes
            </TabsTrigger>
            {(isAdmin || isOperaciones) && (
              <TabsTrigger value="estructurador" className="gap-1.5">
                <Building2 className="w-4 h-4" /> Estructurador
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="nuevo" className="mt-4">
            <OnboardingWizard />
          </TabsContent>
          <TabsContent value="mantenimiento" className="mt-4">
            <IBMaintenance />
          </TabsContent>
          <TabsContent value="herramientas" className="mt-4">
            <SpreadCalculator />
          </TabsContent>
          <TabsContent value="reportes" className="mt-4">
            <Tabs defaultValue="reporte-bd">
              <TabsList>
                <TabsTrigger value="reporte-bd" className="gap-1.5">
                  <BarChart3 className="w-4 h-4" /> Reporte por BD
                </TabsTrigger>
              </TabsList>
              <TabsContent value="reporte-bd" className="mt-4">
                <ReportePorBD />
              </TabsContent>
            </Tabs>
          </TabsContent>
          {(isAdmin || isOperaciones) && (
            <TabsContent value="estructurador" className="mt-4">
              <DirectStructurer />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IBs;
