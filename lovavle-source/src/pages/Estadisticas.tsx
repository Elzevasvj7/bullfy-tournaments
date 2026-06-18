import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BDStats from "@/components/stats/BDStats";
import OpsStats from "@/components/stats/OpsStats";

const Estadisticas = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Estadísticas</h2>
          <p className="text-sm text-muted-foreground mt-1">Métricas clave de rendimiento del equipo</p>
        </div>

        <Tabs defaultValue="bds" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="bds">Business Developers</TabsTrigger>
            <TabsTrigger value="ops">Operaciones</TabsTrigger>
          </TabsList>
          <TabsContent value="bds" className="mt-6">
            <BDStats />
          </TabsContent>
          <TabsContent value="ops" className="mt-6">
            <OpsStats />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Estadisticas;
