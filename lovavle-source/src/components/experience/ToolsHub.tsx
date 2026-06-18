import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Users, Calculator, BarChart3,
  Layers, Target, GitBranch, Building2, Activity, Award, Brain, Download, CheckCircle, Bot
} from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import DownloadResultsDialog from "@/components/experience/DownloadResultsDialog";

interface Tool {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  available: boolean;
  category: string;
  gradient: string;
  iconColor: string;
}

const tools: Tool[] = [
  // Core
  { id: "revenue", title: "IB Revenue Simulator", desc: "Simula tus ingresos según modelo de negocio", icon: DollarSign, available: true, category: "Core", gradient: "from-emerald-500/20 to-green-600/10 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-emerald-500/20", iconColor: "text-emerald-400 bg-emerald-500/20" },
  { id: "growth", title: "Growth Projection Engine", desc: "Proyecta el crecimiento de tu negocio IB", icon: TrendingUp, available: true, category: "Core", gradient: "from-blue-500/20 to-cyan-600/10 border-blue-500/30 hover:border-blue-400/60 hover:shadow-blue-500/20", iconColor: "text-blue-400 bg-blue-500/20" },
  { id: "community", title: "Community Value Calculator", desc: "Calcula el valor de tu comunidad", icon: Users, available: true, category: "Core", gradient: "from-violet-500/20 to-purple-600/10 border-violet-500/30 hover:border-violet-400/60 hover:shadow-violet-500/20", iconColor: "text-violet-400 bg-violet-500/20" },
  // Avanzado
  { id: "empire", title: "IB Empire Builder", desc: "Simula la expansión de tu red IB", icon: Building2, available: true, category: "Avanzado", gradient: "from-amber-500/20 to-orange-600/10 border-amber-500/30 hover:border-amber-400/60 hover:shadow-amber-500/20", iconColor: "text-amber-400 bg-amber-500/20" },
  { id: "network", title: "IB Network Simulator", desc: "Simula estructura con Sub IBs", icon: GitBranch, available: true, category: "Avanzado", gradient: "from-teal-500/20 to-cyan-600/10 border-teal-500/30 hover:border-teal-400/60 hover:shadow-teal-500/20", iconColor: "text-teal-400 bg-teal-500/20" },
  // Gamificación
  { id: "rank", title: "IB Rank Simulator", desc: "Descubre tu nivel como IB", icon: Award, available: true, category: "Gamificación", gradient: "from-yellow-500/20 to-amber-600/10 border-yellow-500/30 hover:border-yellow-400/60 hover:shadow-yellow-500/20", iconColor: "text-yellow-400 bg-yellow-500/20" },
  // Marketing
  { id: "funnel", title: "Funnel Builder", desc: "Construye tu embudo de conversión", icon: Target, available: true, category: "Marketing", gradient: "from-rose-500/20 to-pink-600/10 border-rose-500/30 hover:border-rose-400/60 hover:shadow-rose-500/20", iconColor: "text-rose-400 bg-rose-500/20" },
  // Especializado
  { id: "propfirm", title: "PropFirm Profit Simulator", desc: "Simula ingresos por cuentas de fondeo", icon: Layers, available: true, category: "Especializado", gradient: "from-indigo-500/20 to-blue-600/10 border-indigo-500/30 hover:border-indigo-400/60 hover:shadow-indigo-500/20", iconColor: "text-indigo-400 bg-indigo-500/20" },
  // Comparación
  { id: "comparison", title: "Broker Comparison", desc: "Compara Bullfy vs otros brokers", icon: BarChart3, available: true, category: "Comparación", gradient: "from-sky-500/20 to-blue-600/10 border-sky-500/30 hover:border-sky-400/60 hover:shadow-sky-500/20", iconColor: "text-sky-400 bg-sky-500/20" },
  // Análisis
  { id: "score", title: "IB Success Score", desc: "Evalúa tu potencial como IB", icon: Brain, available: true, category: "Análisis", gradient: "from-fuchsia-500/20 to-purple-600/10 border-fuchsia-500/30 hover:border-fuchsia-400/60 hover:shadow-fuchsia-500/20", iconColor: "text-fuchsia-400 bg-fuchsia-500/20" },
  // AI
  { id: "advisor", title: "AI IB Advisor", desc: "Asesor inteligente para tu negocio IB", icon: Bot, available: true, category: "AI", gradient: "from-lime-500/20 to-green-600/10 border-lime-500/30 hover:border-lime-400/60 hover:shadow-lime-500/20", iconColor: "text-lime-400 bg-lime-500/20" },
  // Trading (last)
  { id: "risk-lot", title: "Risk Lot Size Calculator", desc: "Calcula lotaje según riesgo", icon: Calculator, available: true, category: "Trading", gradient: "from-orange-500/20 to-red-600/10 border-orange-500/30 hover:border-orange-400/60 hover:shadow-orange-500/20", iconColor: "text-orange-400 bg-orange-500/20" },
  { id: "pip-value", title: "Pip Value Calculator", desc: "Calcula el valor por pip", icon: Activity, available: true, category: "Trading", gradient: "from-red-500/20 to-rose-600/10 border-red-500/30 hover:border-red-400/60 hover:shadow-red-500/20", iconColor: "text-red-400 bg-red-500/20" },
];

// Preserve order from array (Trading is last)
const categories = tools.reduce<string[]>((acc, t) => {
  if (!acc.includes(t.category)) acc.push(t.category);
  return acc;
}, []);

const categoryColors: Record<string, string> = {
  Core: "text-emerald-400",
  Avanzado: "text-amber-400",
  Gamificación: "text-yellow-400",
  Marketing: "text-rose-400",
  Especializado: "text-indigo-400",
  Comparación: "text-sky-400",
  Análisis: "text-fuchsia-400",
  AI: "text-lime-400",
  Trading: "text-orange-400",
};

const ToolsHub = () => {
  const { simulationsCount } = useExperienceStore();
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadRequested, setDownloadRequested] = useState(false);

  // Flatten tools with category labels inline
  const rows: { type: "label"; category: string }[] | { type: "tool"; tool: Tool }[] = [];
  const flatItems: ({ type: "label"; category: string } | { type: "tool"; tool: Tool })[] = [];
  let lastCat = "";
  for (const tool of tools) {
    if (tool.category !== lastCat) {
      flatItems.push({ type: "label", category: tool.category });
      lastCat = tool.category;
    }
    flatItems.push({ type: "tool", tool });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Herramientas</h1>
          <p className="text-muted-foreground">Explora nuestras herramientas de simulación y análisis para IBs</p>
        </div>
        {simulationsCount > 0 && (
          downloadRequested ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-400 font-medium">¡Descargados!</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDownloadDialog(true)}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download className="w-4 h-4 mr-1" />
              Descarga mis resultados
            </Button>
          )
        )}
      </div>

      {/* All tools in a single flowing grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {flatItems.map((item, idx) => {
          if (item.type === "label") {
            return (
              <div key={`label-${item.category}`} className="col-span-2 sm:col-span-3 lg:col-span-4 pt-3 first:pt-0">
                <h2 className={`text-xs font-mono uppercase tracking-[0.2em] ${categoryColors[item.category] ?? "text-muted-foreground"}`}>
                  {item.category}
                </h2>
              </div>
            );
          }
          const tool = item.tool;
          return (
            <Link
              key={tool.id}
              to={tool.available ? `/IbBullfyExperience/tools/${tool.id}` : "#"}
              className={tool.available ? "" : "pointer-events-none"}
            >
              <div className={`group relative h-full rounded-xl border bg-gradient-to-br ${tool.gradient} p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${tool.iconColor} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground leading-tight">{tool.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
                {!tool.available && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">Próximamente</Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <DownloadResultsDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onSuccess={() => setDownloadRequested(true)}
      />
    </div>
  );
};

export default ToolsHub;
