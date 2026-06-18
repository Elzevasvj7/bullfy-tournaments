import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitorSmartphone, LayoutDashboard, Users, History, Settings } from "lucide-react";
import MT5Dashboard from "@/components/mt5/MT5Dashboard";
import MT5Accounts from "@/components/mt5/MT5Accounts";
import MT5TradeHistory from "@/components/mt5/MT5TradeHistory";
import MT5Config from "@/components/mt5/MT5Config";

const ConexionMT5 = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Conexión MT5</h2>
            <p className="text-sm text-muted-foreground">Integración con MetaTrader 5 vía API en la nube</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Cuentas</span>
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configuración</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <MT5Dashboard />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <MT5Accounts />
          </TabsContent>
          <TabsContent value="trades" className="mt-6">
            <MT5TradeHistory />
          </TabsContent>
          <TabsContent value="config" className="mt-6">
            <MT5Config />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ConexionMT5;
