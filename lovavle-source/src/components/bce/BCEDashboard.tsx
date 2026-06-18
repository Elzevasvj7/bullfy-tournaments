import { useState } from "react";
import ScenarioSelector from "./ScenarioSelector";
import CallMode from "./CallMode";
import TrainingMode from "./TrainingMode";
import GamificationPanel from "./GamificationPanel";
import AdminTraining from "./AdminTraining";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, GraduationCap, Trophy, Shield } from "lucide-react";

export interface FlowSelection {
  tipoLead: string;
  objetivo: string;
  flowId: string;
  flowName: string;
}

const BCEDashboard = () => {
  const { isGlobalAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("call");
  const [selectedFlow, setSelectedFlow] = useState<FlowSelection | null>(null);
  const [callActive, setCallActive] = useState(false);

  const handleStartCall = (flow: FlowSelection) => {
    setSelectedFlow(flow);
    setCallActive(true);
  };

  const handleEndCall = () => {
    setCallActive(false);
    setSelectedFlow(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          🔥 Bullfy Closing Engine
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Motor interactivo de cierre de ventas en tiempo real
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="call" className="gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Call Mode
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Entrenamiento
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Ranking
          </TabsTrigger>
          {isGlobalAdmin && (
            <TabsTrigger value="admin-training" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Entrenar Sistema
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="call" className="mt-4">
          {!callActive ? (
            <ScenarioSelector onStart={handleStartCall} />
          ) : (
            <CallMode flow={selectedFlow!} onEnd={handleEndCall} />
          )}
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <TrainingMode />
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <GamificationPanel />
        </TabsContent>


        {isGlobalAdmin && (
          <TabsContent value="admin-training" className="mt-4">
            <AdminTraining />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default BCEDashboard;
