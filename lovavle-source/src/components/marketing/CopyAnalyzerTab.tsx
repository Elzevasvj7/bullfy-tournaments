import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import {
  Sparkles, Loader2, BarChart3, Image as ImageIcon, Trash2,
  TrendingUp, Hash, Clock, Target, MessageSquare, Brain, Users, Shield,
  ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, Download, Presentation, Copy, ExternalLink
} from "lucide-react";
import NeuralDebateAnimation from "./NeuralDebateAnimation";

interface AgentResult {
  name: string;
  role: "expert" | "persona";
  emoji: string;
  color: string;
  profile: string;
  result: any;
  error: boolean;
}

interface ModeratorResult {
  consensus_score: number;
  viral_potential: string;
  approval_rate: string;
  summary: string;
  biggest_debate: string;
  expert_consensus: string;
  audience_consensus: string;
  deal_breakers: string[];
  universal_praise: string[];
  final_recommendations: { priority: string; recommendation: string }[];
  predicted_engagement: Record<string, string>;
  best_posting_times: string[];
  hashtag_suggestions: string[];
  target_segments_ranking: { segment: string; score: number; reasoning: string }[];
}

interface MultiAgentResult {
  agent_count: number;
  agents: Record<string, AgentResult>;
  moderator: ModeratorResult;
}

const CopyAnalyzerTab = () => {
  const [copyText, setCopyText] = useState("");
  const [assetName, setAssetName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MultiAgentResult | null>(null);
  const [debatePhase, setDebatePhase] = useState<"thinking" | "debating" | "consensus" | "done">("thinking");
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [creatingPresentation, setCreatingPresentation] = useState(false);
  const [presentationUrl, setPresentationUrl] = useState<string | null>(null);
  // Agent definitions for animation (must match edge function)
  const agentDefs = [
    { id: "strategist", name: "Valentina Rojas", emoji: "🎯", color: "#e74c3c", role: "expert" as const },
    { id: "copywriter", name: "Diego Paredes", emoji: "✍️", color: "#f39c12", role: "expert" as const },
    { id: "creative_director", name: "Camila Vargas", emoji: "🎨", color: "#9b59b6", role: "expert" as const },
    { id: "growth_hacker", name: "Mateo Rivas", emoji: "🚀", color: "#2ecc71", role: "expert" as const },
    { id: "compliance", name: "Roberto Méndez", emoji: "⚖️", color: "#34495e", role: "expert" as const },
    { id: "carlos_trader", name: "Carlos Mendoza", emoji: "📈", color: "#e67e22", role: "persona" as const },
    { id: "maria_ib", name: "María F. López", emoji: "🤝", color: "#1abc9c", role: "persona" as const },
    { id: "diego_novato", name: "Diego Ramírez", emoji: "🌱", color: "#3498db", role: "persona" as const },
    { id: "lucia_institucional", name: "Lucía Castellanos", emoji: "🏛️", color: "#8e44ad", role: "persona" as const },
    { id: "andres_crypto", name: "Andrés Villamizar", emoji: "🪙", color: "#f1c40f", role: "persona" as const },
    { id: "rosa_jubilada", name: "Rosa Elena Torres", emoji: "👵", color: "#e91e63", role: "persona" as const },
    { id: "kevin_genz", name: "Kevin Solís", emoji: "📱", color: "#00bcd4", role: "persona" as const },
    { id: "patricia_feminista", name: "Patricia Herrera", emoji: "💜", color: "#7c4dff", role: "persona" as const },
    { id: "jorge_empresario", name: "Jorge A. Vega", emoji: "💼", color: "#ff5722", role: "persona" as const },
    { id: "valentina_mama", name: "Valentina Restrepo", emoji: "👩‍👧", color: "#4caf50", role: "persona" as const },
    { id: "samuel_tech", name: "Samuel Ortiz", emoji: "🤖", color: "#607d8b", role: "persona" as const },
    { id: "carmen_influencer", name: "Carmen Delgado", emoji: "🌟", color: "#ff9800", role: "persona" as const },
    { id: "ricardo_sindical", name: "Ricardo Peña", emoji: "✊", color: "#795548", role: "persona" as const },
  ];

  const handleDownloadPDF = useCallback(async () => {
    if (!result) return;
    setGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = doc.internal.pageSize.getWidth();
      const mod = result.moderator;
      let y = 20;

      // Title
      doc.setFontSize(22);
      doc.setTextColor(6, 43, 99);
      doc.text("Bullfy Brain — Análisis Multi-Agente", w / 2, y, { align: "center" });
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(20, 110, 245);
      doc.text(assetName || "Campaña sin nombre", w / 2, y, { align: "center" });
      y += 12;

      // Consensus
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Puntuación de Consenso: ${mod.consensus_score || 0}/100`, 15, y);
      y += 7;
      doc.text(`Potencial Viral: ${mod.viral_potential || "N/A"}`, 15, y);
      y += 7;
      doc.text(`Tasa de Aprobación: ${mod.approval_rate || "N/A"}`, 15, y);
      y += 10;

      if (mod.summary) {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(mod.summary, w - 30);
        doc.text(lines, 15, y);
        y += lines.length * 5 + 5;
      }

      // Expert & Audience consensus
      doc.setFontSize(11);
      doc.setTextColor(6, 43, 99);
      doc.text("Consenso Expertos:", 15, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(80);
      if (mod.expert_consensus) {
        const el = doc.splitTextToSize(mod.expert_consensus, w - 30);
        doc.text(el, 15, y); y += el.length * 4.5 + 4;
      }
      doc.setFontSize(11);
      doc.setTextColor(6, 43, 99);
      doc.text("Consenso Audiencia:", 15, y); y += 6;
      doc.setFontSize(9);
      doc.setTextColor(80);
      if (mod.audience_consensus) {
        const al = doc.splitTextToSize(mod.audience_consensus, w - 30);
        doc.text(al, 15, y); y += al.length * 4.5 + 4;
      }

      // Agents
      const allAgents = Object.values(result.agents) as AgentResult[];
      for (const agent of allAgents) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`${agent.emoji} ${agent.name} (${agent.role === "expert" ? "Experto" : "Persona"}) — ${agent.result?.score ?? "?"}/100`, 15, y);
        y += 5;
        if (agent.result?.analysis) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          const al = doc.splitTextToSize(agent.result.analysis, w - 30);
          doc.text(al, 15, y); y += al.length * 3.5 + 4;
        }
      }

      // Recommendations
      if (mod.final_recommendations?.length) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(6, 43, 99);
        doc.text("Recomendaciones Finales:", 15, y); y += 7;
        for (const r of mod.final_recommendations) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setTextColor(0);
          const rl = doc.splitTextToSize(`[${r.priority}] ${r.recommendation}`, w - 30);
          doc.text(rl, 15, y); y += rl.length * 4 + 3;
        }
      }

      doc.save(`bullfy-brain-${(assetName || "analisis").replace(/\s+/g, "-")}.pdf`);
      toast.success("PDF descargado correctamente");
    } catch (err: any) {
      toast.error("Error generando PDF: " + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  }, [result, assetName]);

  const handleCreatePresentation = useCallback(async () => {
    if (!result) return;
    setCreatingPresentation(true);
    try {
      const slug = `${(assetName || "analisis").replace(/\s+/g, "-").toLowerCase()}-${Date.now().toString(36)}`;
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("campaign_presentations").insert({
        slug,
        campaign_name: assetName || "Campaña sin nombre",
        copy_text: copyText || null,
        image_url: imagePreview || null,
        analysis_data: result as any,
        created_by: user?.id || null,
      });

      if (error) throw error;

      const url = `https://bullfytech.online/p/${slug}`;
      setPresentationUrl(url);
      toast.success("Presentación interactiva creada");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setCreatingPresentation(false);
    }
  }, [result, assetName, copyText, imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("La imagen no puede superar 10MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Simulate progressive agent completion during analysis
  useEffect(() => {
    if (!analyzing) return;
    setCompletedAgents([]);
    setDebatePhase("thinking");

    const shuffled = [...agentDefs].sort(() => Math.random() - 0.5);
    const timers: NodeJS.Timeout[] = [];

    shuffled.forEach((agent, i) => {
      timers.push(setTimeout(() => {
        setCompletedAgents(prev => [...prev, agent.id]);
        if (i === Math.floor(shuffled.length / 2)) setDebatePhase("debating");
        if (i === shuffled.length - 1) setDebatePhase("consensus");
      }, 1500 + i * 800 + Math.random() * 600));
    });

    return () => timers.forEach(clearTimeout);
  }, [analyzing]);

  const handleAnalyze = async () => {
    if (!copyText.trim() && !imageFile) {
      toast.error("Escribe un copy/idea o sube una imagen para analizar");
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      let assetUrl = "";
      let assetType = "text";

      if (imageFile) {
        const path = `analyzer/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("video-clips")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("video-clips").getPublicUrl(path);
        assetUrl = urlData.publicUrl;
        assetType = "image";
      }

      const { data, error } = await supabase.functions.invoke("analyze-campaign-multiagent", {
        body: {
          asset_url: assetUrl || "text-only",
          asset_type: assetType,
          copy_text: copyText,
          asset_name: assetName || undefined,
        },
      });

      if (error) throw error;

      const analysisResult = data as MultiAgentResult;
      setResult(analysisResult);
      setDebatePhase("done");
      toast.success(`Análisis multi-agente completado (${data.agent_count} agentes)`);

      // Auto-save to history
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("brain_analysis_history").insert({
          campaign_name: assetName || "Sin nombre",
          copy_text: copyText || null,
          image_url: assetUrl || null,
          asset_type: assetType,
          analysis_data: analysisResult as any,
          consensus_score: analysisResult.moderator?.consensus_score ?? null,
          viral_potential: analysisResult.moderator?.viral_potential ?? null,
          agent_count: analysisResult.agent_count ?? null,
          created_by: user?.id || null,
        });
      } catch (saveErr) {
        console.warn("No se pudo guardar en historial:", saveErr);
      }
    } catch (err: any) {
      if (err.message?.includes("429") || err.status === 429) {
        toast.error("Límite alcanzado. Intenta más tarde.");
      } else if (err.message?.includes("402") || err.status === 402) {
        toast.error("Créditos de IA agotados.");
      } else {
        toast.error("Error: " + (err.message || "Error desconocido"));
      }
      setDebatePhase("done");
    } finally {
      setAnalyzing(false);
    }
  };

  const engagementColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "viral": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "alto": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "medio": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const verdictIcon = (v: string) => {
    if (!v) return null;
    if (v === "aprobado" || v === "me_encanta") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (v === "aprobado_con_reservas" || v === "interesante") return <ThumbsUp className="w-4 h-4 text-blue-500" />;
    if (v === "rechazado" || v === "me_molesta" || v === "no_me_gusta") return <ThumbsDown className="w-4 h-4 text-red-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const animationAgents = agentDefs.map(a => ({
    ...a,
    done: completedAgents.includes(a.id),
  }));

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Bullfy Brain — Análisis Multi-Agente
          </CardTitle>
          <CardDescription>
            18 agentes de IA con personalidades, edades, perspectivas y opiniones diversas debaten tu contenido y emiten un veredicto colectivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de la campaña (opcional)</Label>
            <Input
              value={assetName}
              onChange={e => setAssetName(e.target.value)}
              placeholder="Ej: Campaña Black Friday 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Copy / Idea / Concepto *</Label>
            <Textarea
              value={copyText}
              onChange={e => setCopyText(e.target.value)}
              placeholder="Escribe aquí tu copy, script de video, idea de post, concepto de campaña..."
              rows={5}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">{copyText.length} caracteres</p>
          </div>

          <div className="space-y-2">
            <Label>Imagen de referencia (opcional)</Label>
            {imagePreview ? (
              <div className="relative w-fit">
                <img src={imagePreview} alt="preview" className="max-h-40 rounded-lg border" />
                <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={clearImage}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Sube una imagen de referencia (máx 10MB)</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || (!copyText.trim() && !imageFile)}
            className="w-full gap-2"
            size="lg"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 18 Agentes analizando...</>
            ) : (
              <><Brain className="w-4 h-4" /> Iniciar Debate Multi-Agente</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Neural Debate Animation */}
      {(analyzing || result) && (
        <Card>
          <CardContent className="pt-6">
            <NeuralDebateAnimation
              agents={animationAgents}
              phase={debatePhase}
              currentAgentId={completedAgents[completedAgents.length - 1]}
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {result && result.moderator && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleDownloadPDF} disabled={generatingPdf} variant="outline" className="flex-1 gap-2">
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Descargar Reporte PDF
              </Button>
              <Button onClick={handleCreatePresentation} disabled={creatingPresentation} className="flex-1 gap-2 bg-[#146EF5] hover:bg-[#0f5ad4]">
                {creatingPresentation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
                Presentación Interactiva
              </Button>
            </div>
            {presentationUrl && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                <a href={presentationUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  {presentationUrl}
                </a>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(presentationUrl); toast.success("Link copiado"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && result.moderator && (
        <>
          {/* Consensus Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Veredicto del Consenso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-primary">{result.moderator.consensus_score || 0}</div>
                <div className="flex-1 space-y-2">
                  <Progress value={result.moderator.consensus_score || 0} className="h-3" />
                  <div className="flex gap-2">
                    <Badge className={engagementColor(result.moderator.viral_potential || "")}>
                      {result.moderator.viral_potential || "N/A"} potencial viral
                    </Badge>
                    <Badge variant="outline">{result.moderator.approval_rate || "?"} aprobación</Badge>
                  </div>
                </div>
              </div>
              {result.moderator.summary && (
                <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{result.moderator.summary}</p>
              )}
            </CardContent>
          </Card>

          {/* Expert vs Audience Consensus */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Consenso de Expertos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.moderator.expert_consensus}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Consenso de Audiencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.moderator.audience_consensus}</p>
              </CardContent>
            </Card>
          </div>

          {/* Biggest Debate */}
          {result.moderator.biggest_debate && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" /> Mayor Punto de Debate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.moderator.biggest_debate}</p>
              </CardContent>
            </Card>
          )}

          {/* Individual Agent Verdicts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> Veredictos Individuales
              </CardTitle>
              <CardDescription>Cada agente con su perspectiva única</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="experts">
                <TabsList className="mb-4">
                  <TabsTrigger value="experts">🎓 Expertos ({Object.values(result.agents).filter(a => a.role === "expert").length})</TabsTrigger>
                  <TabsTrigger value="personas">👥 Personas ({Object.values(result.agents).filter(a => a.role === "persona").length})</TabsTrigger>
                </TabsList>

                <TabsContent value="experts" className="space-y-3">
                  {Object.entries(result.agents).filter(([, a]) => a.role === "expert").map(([id, agent]) => (
                    <div key={id} className="p-4 rounded-lg border" style={{ borderLeftColor: agent.color, borderLeftWidth: 4 }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{agent.emoji}</span>
                          <div>
                            <span className="font-semibold text-sm">{agent.name}</span>
                            <p className="text-xs text-muted-foreground">{agent.profile}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.result && verdictIcon(agent.result.verdict)}
                          <Badge variant="outline">{agent.result?.score ?? "?"}/100</Badge>
                        </div>
                      </div>
                      {agent.result?.analysis && <p className="text-sm text-muted-foreground mt-2">{agent.result.analysis}</p>}
                      {agent.result?.strengths?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.result.strengths.map((s: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">✅ {s}</Badge>
                          ))}
                        </div>
                      )}
                      {agent.result?.weaknesses?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.result.weaknesses.map((w: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs text-red-500">⚠️ {w}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="personas" className="space-y-3">
                  {Object.entries(result.agents).filter(([, a]) => a.role === "persona").map(([id, agent]) => (
                    <div key={id} className="p-4 rounded-lg border" style={{ borderLeftColor: agent.color, borderLeftWidth: 4 }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{agent.emoji}</span>
                          <div>
                            <span className="font-semibold text-sm">{agent.name}</span>
                            <p className="text-xs text-muted-foreground line-clamp-1">{agent.profile}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.result && verdictIcon(agent.result.verdict)}
                          <Badge variant="outline">{agent.result?.score ?? "?"}/100</Badge>
                        </div>
                      </div>
                      {agent.result?.first_reaction && (
                        <p className="text-sm italic text-muted-foreground mt-2">"{agent.result.first_reaction}"</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {agent.result?.would_click && <Badge className="bg-green-500/10 text-green-600 text-xs">Haría clic ✓</Badge>}
                        {agent.result?.would_share && <Badge className="bg-blue-500/10 text-blue-600 text-xs">Compartiría ✓</Badge>}
                        {agent.result?.would_follow && <Badge className="bg-purple-500/10 text-purple-600 text-xs">Seguiría ✓</Badge>}
                        {agent.result?.emotional_response && (
                          <Badge variant="outline" className="text-xs">{agent.result.emotional_response}</Badge>
                        )}
                      </div>
                      {agent.result?.what_would_improve_it && (
                        <p className="text-xs text-muted-foreground mt-2">💡 {agent.result.what_would_improve_it}</p>
                      )}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Predicted Engagement */}
          {result.moderator.predicted_engagement && Object.keys(result.moderator.predicted_engagement).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Engagement por Plataforma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(result.moderator.predicted_engagement).map(([platform, level]) => (
                    <div key={platform} className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{platform}:</span>
                      <Badge className={engagementColor(level)}>{level}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Segments, Times, Hashtags, Recommendations */}
          {result.moderator.target_segments_ranking?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Segmentos Objetivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.moderator.target_segments_ranking.map((seg, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{seg.segment}</span>
                      <span className="text-sm font-bold text-primary">{seg.score}/100</span>
                    </div>
                    <Progress value={seg.score} className="h-2" />
                    <p className="text-xs text-muted-foreground">{seg.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.moderator.best_posting_times?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Mejores Horarios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.moderator.best_posting_times.map((t, i) => (
                      <Badge key={i} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {result.moderator.hashtag_suggestions?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="w-4 h-4 text-primary" /> Hashtags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.moderator.hashtag_suggestions.map((h, i) => (
                      <Badge key={i} variant="outline" className="text-primary">{h}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {result.moderator.final_recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Recomendaciones Finales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.moderator.final_recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant={r.priority === "alta" ? "destructive" : r.priority === "media" ? "secondary" : "outline"} className="shrink-0 text-xs">
                      {r.priority}
                    </Badge>
                    <p className="text-sm">{r.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Praise & Deal Breakers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.moderator.universal_praise?.length > 0 && (
              <Card className="border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" /> Elogios Universales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {result.moderator.universal_praise.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">✅ {p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {result.moderator.deal_breakers?.length > 0 && (
              <Card className="border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-4 h-4" /> Deal Breakers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {result.moderator.deal_breakers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">🚨 {d}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CopyAnalyzerTab;
