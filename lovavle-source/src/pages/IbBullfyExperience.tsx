import { Routes, Route } from "react-router-dom";
import ExperienceLayout from "@/components/experience/ExperienceLayout";
import ExperienceLanding from "@/components/experience/ExperienceLanding";
import ExperienceDashboard from "@/components/experience/ExperienceDashboard";
import ToolsHub from "@/components/experience/ToolsHub";
import RevenueSimulator from "@/components/experience/tools/RevenueSimulator";
import GrowthProjection from "@/components/experience/tools/GrowthProjection";
import CommunityCalculator from "@/components/experience/tools/CommunityCalculator";
import RiskLotCalculator from "@/components/experience/tools/RiskLotCalculator";
import PipValueCalculator from "@/components/experience/tools/PipValueCalculator";
import EmpireBuilder from "@/components/experience/tools/EmpireBuilder";
import IBRankSimulator from "@/components/experience/tools/IBRankSimulator";
import FunnelBuilder from "@/components/experience/tools/FunnelBuilder";
import PropFirmSimulator from "@/components/experience/tools/PropFirmSimulator";
import NetworkSimulator from "@/components/experience/tools/NetworkSimulator";
import BrokerComparison from "@/components/experience/tools/BrokerComparison";
import IBSuccessScore from "@/components/experience/tools/IBSuccessScore";
import AIAdvisor from "@/components/experience/tools/AIAdvisor";
import LeadCapture from "@/components/experience/LeadCapture";
import SimulationHistory from "@/components/experience/SimulationHistory";

const TOOL_ROUTES: Record<string, React.ComponentType> = {
  revenue: RevenueSimulator,
  growth: GrowthProjection,
  community: CommunityCalculator,
  "risk-lot": RiskLotCalculator,
  "pip-value": PipValueCalculator,
  empire: EmpireBuilder,
  rank: IBRankSimulator,
  funnel: FunnelBuilder,
  propfirm: PropFirmSimulator,
  network: NetworkSimulator,
  comparison: BrokerComparison,
  score: IBSuccessScore,
  advisor: AIAdvisor,
};

const IbBullfyExperience = () => (
  <ExperienceLayout>
    <Routes>
      <Route index element={<ExperienceLanding />} />
      <Route path="dashboard" element={<ExperienceDashboard />} />
      <Route path="tools" element={<ToolsHub />} />
      {Object.entries(TOOL_ROUTES).map(([id, Component]) => (
        <Route key={id} path={`tools/${id}`} element={<Component />} />
      ))}
      <Route path="historial" element={<SimulationHistory />} />
      <Route path="contacto" element={<LeadCapture />} />
    </Routes>
  </ExperienceLayout>
);

export default IbBullfyExperience;
