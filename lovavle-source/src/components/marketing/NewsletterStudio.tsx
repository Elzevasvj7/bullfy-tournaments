import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Eye, RefreshCw, Newspaper, Zap, CheckCircle2, XCircle, Clock, Mail, BarChart3, History, Users, Briefcase, GraduationCap, MapPin, Award, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import NewsletterAgentAnimation from "./NewsletterAgentAnimation";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Borrador", color: "bg-gray-500", icon: Clock },
  generating: { label: "Generando...", color: "bg-yellow-500", icon: Loader2 },
  reviewing: { label: "En revisión", color: "bg-blue-500", icon: Eye },
  approved: { label: "Aprobado", color: "bg-green-500", icon: CheckCircle2 },
  sent: { label: "Enviado", color: "bg-primary", icon: Send },
  verified: { label: "Verificado", color: "bg-emerald-600", icon: CheckCircle2 },
  failed: { label: "Error", color: "bg-red-500", icon: XCircle },
};

const ROLES = [
  { value: "bd", label: "Business Developers" },
  { value: "admin", label: "Administradores" },
  { value: "ib_externo", label: "IBs Externos" },
  { value: "operaciones", label: "Operaciones" },
  { value: "marketing", label: "Marketing" },
  { value: "ventas", label: "Ventas" },
  { value: "partner_users", label: "Usuarios Partner Portals" },
];

const FREQUENCY_OPTIONS = [
  { value: "on_demand", label: "Bajo Demanda" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

// Agent pipeline steps with expected actions for progress mapping
const AGENT_STEPS = [
  { agent: "Diana", emoji: "🎯", action: "validate_team", label: "Reclutadora - Validando equipo", pct: 8 },
  { agent: "Marcus", emoji: "🔍", action: "research_news", label: "Investigador - Scraping noticias", pct: 22 },
  { agent: "Vanessa", emoji: "🍷", action: "research_gossip", label: "Gossip Editor - Wall Street", pct: 32 },
  { agent: "Sofia", emoji: "✍️", action: "write_copy", label: "Copywriter - Redactando contenido", pct: 42 },
  { agent: "James", emoji: "📝", action: "grammar_edit", label: "Editor Gramática - Puliendo texto", pct: 52 },
  { agent: "Carlos", emoji: "🎲", action: "create_cta", label: "Estratega CTA - Predicción", pct: 60 },
  { agent: "Yuki", emoji: "🎨", action: "design_layout", label: "Diseñadora - Layout visual", pct: 70 },
  { agent: "Richard", emoji: "🏆", action: "final_review", label: "Director - Revisión final", pct: 85 },
  { agent: "HTML", emoji: "📧", action: "build_html", label: "Generando HTML del email", pct: 95 },
];

// Full agent profiles for the curriculum section
const AGENT_PROFILES = [
  {
    name: "Diana Voss", emoji: "🎯", role: "Reclutadora de Talento",
    age: 42, nationality: "🇩🇪 Alemana", color: "#FF6B6B",
    title: "Directora de Adquisición de Talento",
    experience: "18 años en headhunting para medios financieros",
    background: ["Bloomberg", "Reuters", "Financial Times"],
    skills: ["Evaluación de perfiles editoriales", "Formación de equipos de alto rendimiento", "Análisis de competencias"],
    contribution: "Valida que cada agente del equipo tenga las credenciales para producir contenido de clase mundial.",
  },
  {
    name: "Marcus Chen", emoji: "🔍", role: "Investigador Senior",
    age: 38, nationality: "🇺🇸 Chino-Americano", color: "#4ECDC4",
    title: "Ex-Analista Senior de Reuters",
    experience: "15 años en periodismo financiero investigativo",
    background: ["Reuters", "Wall Street Journal", "CNBC"],
    skills: ["MarketAux API", "Firecrawl scraping", "Verificación de hechos"],
    contribution: "Investiga y selecciona las noticias financieras más relevantes de fuentes verificadas en tiempo real.",
  },
  {
    name: "Vanessa Drake", emoji: "🍷", role: "Gossip Editor de Wall Street",
    age: 41, nationality: "🇺🇸 Estadounidense", color: "#E91E63",
    title: "Ex-Editora de Page Six & Dealbreaker",
    experience: "16 años como editora de chismes corporativos",
    background: ["Page Six", "Dealbreaker", "Business Insider"],
    skills: ["NewsAPI búsqueda", "Periodismo de lifestyle", "Investigación de CEOs"],
    contribution: "Convierte rumores de Wall Street en periodismo estructurado para la sección 'Los Susurros de Wall Street'.",
    conditional: true,
  },
  {
    name: "Sofía Hernández", emoji: "✍️", role: "Copywriter Financiera (Técnica)",
    age: 35, nationality: "🇨🇴🇪🇸 Colombo-Española", color: "#FFE66D",
    title: "Ex-Editora de The Economist en Español",
    experience: "12 años en copys financieros premium",
    background: ["The Economist", "Expansión", "Bloomberg Línea"],
    skills: ["Narrativa financiera cautivadora", "Tono editorial premium", "Storytelling de datos"],
    contribution: "Transforma las noticias en narrativas financieras cautivadoras con tono profesional y accesible.",
    style: "technical",
  },
  {
    name: "Valentina Torres", emoji: "🌟", role: "Copywriter Storyteller",
    age: 28, nationality: "🇲🇽 Mexicana", color: "#FF9F43",
    title: "Ex-Creadora de Contenido en Finimize & The Hustle",
    experience: "7 años transformando finanzas complejas en historias simples",
    background: ["Finimize", "The Hustle", "Morning Brew Español"],
    skills: ["Storytelling financiero", "Analogías cotidianas", "Engagement juvenil", "Simplificación de conceptos"],
    contribution: "Convierte jerga financiera compleja en historias que cualquier persona de 20-40 años entiende sin esfuerzo.",
    style: "storyteller",
  },
  {
    name: "James Whitmore", emoji: "📝", role: "Editor de Estilo",
    age: 55, nationality: "🇬🇧 Británico", color: "#A8E6CF",
    title: "Ex-Corrector de The Financial Times",
    experience: "25 años como corrector de estilo editorial",
    background: ["The Financial Times", "The Guardian", "The Economist"],
    skills: ["Corrección gramatical avanzada", "Coherencia tonal", "Estilo editorial británico"],
    contribution: "Pule cada palabra asegurando perfección gramatical, fluidez lectora y coherencia tonal.",
  },
  {
    name: "Yuki Tanaka", emoji: "🎨", role: "Directora Creativa",
    age: 29, nationality: "🇯🇵 Japonesa", color: "#DDA0DD",
    title: "Directora Creativa de Startups Fintech",
    experience: "8 años en Silicon Valley diseñando para fintech",
    background: ["Stripe Design", "Square", "Robinhood"],
    skills: ["Diseño editorial premium", "Generación de assets con IA", "Estética minimalista japonesa"],
    contribution: "Diseña el layout visual y genera imágenes editoriales que elevan el newsletter a nivel de revista premium.",
  },
  {
    name: "Carlos Mendoza", emoji: "❓", role: "Estratega CTA & Gamificación",
    age: 45, nationality: "🇲🇽 Mexicano", color: "#FFB347",
    title: "Especialista en Engagement Interactivo",
    experience: "17 años en medios interactivos y gamificación",
    background: ["Duolingo", "Morning Brew", "The Hustle"],
    skills: ["Diseño de predicciones financieras", "Gamificación de audiencias", "Psicología del engagement"],
    contribution: "Crea las preguntas de predicción del mercado que generan interacción y retención de audiencia.",
  },
  {
    name: "Richard Blackwell", emoji: "🏆", role: "Director de Edición",
    age: 58, nationality: "🇺🇸 Estadounidense", color: "#87CEEB",
    title: "Director Editorial — Autoridad de Veto",
    experience: "22 años dirigiendo newsletters premiados",
    background: ["Morning Brew", "The Hustle", "Axios"],
    skills: ["Visión editorial estratégica", "Control de calidad final", "Poder de veto y corrección"],
    contribution: "Revisión final integral. Tiene autoridad para vetar o solicitar correcciones antes de aprobar la edición.",
  },
  {
    name: "Dr. Amara Okafor", emoji: "⚖️", role: "Verificadora de Datos",
    age: 48, nationality: "🇳🇬🇬🇧 Nigeriana-Británica", color: "#98FB98",
    title: "PhD en Economía — Ex-Goldman Sachs",
    experience: "20 años en análisis cuantitativo de mercados",
    background: ["Goldman Sachs", "Bank of England", "Oxford University"],
    skills: ["Verificación de predicciones financieras", "Análisis cuantitativo", "Evaluación de resultados con IA"],
    contribution: "Verifica las predicciones 24h después, asigna puntos y valida los resultados con evidencia del mercado.",
  },
];

const NewsletterStudio = () => {
  const [editions, setEditions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [frequency, setFrequency] = useState("on_demand");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["bd"]);
  const [campaignName, setCampaignName] = useState("Bullfy Markets Daily");
  const [gossipMode, setGossipMode] = useState(false);
  const [copywriterStyle, setCopywriterStyle] = useState<"technical" | "storyteller">("technical");
  const [testEmail, setTestEmail] = useState("");
  const [previewEdition, setPreviewEdition] = useState<any>(null);
  const [sendDialogEdition, setSendDialogEdition] = useState<any>(null);
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);

  // Real-time progress state
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEditions();
  }, []);

  // Realtime subscription for live agent logs during generation
  useEffect(() => {
    if (!activeGenerationId) {
      setLiveLogs([]);
      setProgressPct(0);
      setCurrentStep("");
      return;
    }

    // Fetch any existing logs for this edition
    (async () => {
      const { data } = await (supabase.from as any)("newsletter_agent_logs")
        .select("*")
        .eq("edition_id", activeGenerationId)
        .order("created_at", { ascending: true });
      if (data?.length) {
        setLiveLogs(data);
        updateProgressFromLogs(data);
      }
    })();

    // Subscribe to new inserts
    const channel = supabase
      .channel(`newsletter-progress-${activeGenerationId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "newsletter_agent_logs",
          filter: `edition_id=eq.${activeGenerationId}`,
        },
        (payload: any) => {
          const newLog = payload.new;
          setLiveLogs(prev => {
            const updated = [...prev, newLog];
            updateProgressFromLogs(updated);
            return updated;
          });
        }
      )
      .subscribe();

    // Also poll edition status
    const interval = setInterval(async () => {
      const { data } = await (supabase.from as any)("newsletter_editions")
        .select("status, content_json").eq("id", activeGenerationId).single();
      if (data && data.status !== "generating") {
        setActiveGenerationId(null);
        setGenerating(false);
        setProgressPct(100);
        setCurrentStep("✅ ¡Completado!");
        fetchEditions();
        if (data.status === "reviewing") {
          toast({ title: "✅ Newsletter generado", description: "Listo para revisión y envío." });
        } else if (data.status === "failed") {
          const errorDetail = data.content_json?.error || "Error desconocido en generación";
          setCurrentStep("❌ " + errorDetail);
          toast({ title: "❌ Error en generación", description: errorDetail, variant: "destructive" });
        }
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeGenerationId]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  const updateProgressFromLogs = (logs: any[]) => {
    if (!logs.length) return;
    const lastLog = logs[logs.length - 1];
    const action = lastLog.action;
    const agentName = lastLog.agent_name;

    // Find matching step
    const stepIdx = AGENT_STEPS.findIndex(
      s => s.action === action || agentName?.includes(s.agent)
    );
    if (stepIdx >= 0) {
      const step = AGENT_STEPS[stepIdx];
      setProgressPct(step.pct);
      setCurrentStep(`${step.emoji} ${step.label}`);
    } else {
      // Unknown action — estimate based on log count
      const estimated = Math.min(90, logs.length * 12);
      setProgressPct(estimated);
      setCurrentStep(`${lastLog.agent_emoji || "🤖"} ${lastLog.agent_name || "Procesando"} — ${lastLog.action}`);
    }
  };

  const fetchEditions = async () => {
    const { data } = await (supabase.from as any)("newsletter_editions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setEditions(data || []);
    setLoading(false);
  };

  const fetchLogs = async (editionId: string) => {
    const { data } = await (supabase.from as any)("newsletter_agent_logs")
      .select("*")
      .eq("edition_id", editionId)
      .order("created_at", { ascending: true });
    setAgentLogs(data || []);
    setShowLogs(editionId);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setLiveLogs([]);
    setProgressPct(2);
    setCurrentStep("🚀 Iniciando generación...");
    try {
      const { data: edition, error: createErr } = await (supabase.from as any)("newsletter_editions")
        .insert({
          campaign_name: campaignName,
          environment,
          frequency,
          target_roles: selectedRoles,
          gossip_mode: gossipMode,
          copywriter_style: copywriterStyle,
          status: "draft",
        })
        .select()
        .single();

      if (createErr) throw createErr;

      setActiveGenerationId(edition.id);

      supabase.functions.invoke("newsletter-generate", {
        body: { edition_id: edition.id },
      }).catch(err => {
        console.error("Generation error:", err);
        setGenerating(false);
        setActiveGenerationId(null);
      });

      toast({ title: "🧠 Generando newsletter...", description: "Sigue el progreso en tiempo real abajo." });
      fetchEditions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setGenerating(false);
    }
  };

  const handleSend = async (editionId: string) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-send", {
        body: {
          edition_id: editionId,
          test_email: environment === "test" ? testEmail : undefined,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Error al enviar");
      toast({ title: "📧 Newsletter enviado", description: `Enviado a ${data.sent_count} destinatarios.` });
      fetchEditions();
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendCustomEmails = async () => {
    if (!sendDialogEdition || customEmails.length === 0) return;
    setSendingCustom(true);
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-send", {
        body: { edition_id: sendDialogEdition.id, custom_emails: customEmails },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Error al enviar");
      toast({ title: "📧 Newsletter enviado", description: `Enviado a ${data.sent_count} destinatario(s).` });
      setSendDialogEdition(null);
      setCustomEmails([]);
      setEmailInput("");
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSendingCustom(false);
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !customEmails.includes(email)) {
      setCustomEmails(prev => [...prev, email]);
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setCustomEmails(prev => prev.filter(e => e !== email));
  };

  const handleVerify = async (editionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-verify-prediction", {
        body: { edition_id: editionId },
      });
      if (error) throw error;
      toast({ title: "⚖️ Verificación completada" });
      fetchEditions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (editionId: string) => {
    try {
      await (supabase.from as any)("newsletter_agent_logs").delete().eq("edition_id", editionId);
      await (supabase.from as any)("newsletter_editions").delete().eq("id", editionId);
      toast({ title: "🗑️ Newsletter eliminado" });
      fetchEditions();
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Newspaper className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-bold">Newsletter Studio</h3>
          <p className="text-xs text-muted-foreground">
            Sistema multi-agente automatizado con 8 agentes especializados
          </p>
        </div>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create" className="gap-1">
            <Zap className="w-3 h-3" /> Crear Newsletter
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="w-3 h-3" /> Ediciones
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1">
            <Users className="w-3 h-3" /> Equipo de Agentes
          </TabsTrigger>
        </TabsList>

        {/* ── Create Tab ── */}
        <TabsContent value="create" className="mt-4 space-y-4">
          {/* Config - full width on top */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre de la edición</Label>
                  <Input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Entorno</Label>
                  <div className="flex items-center gap-2 h-8">
                    <span className={`text-xs ${environment === "test" ? "text-yellow-400" : "text-muted-foreground"}`}>
                      Prueba
                    </span>
                    <Switch
                      checked={environment === "production"}
                      onCheckedChange={v => setEnvironment(v ? "production" : "test")}
                    />
                    <span className={`text-xs ${environment === "production" ? "text-green-400" : "text-muted-foreground"}`}>
                      Producción
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Frecuencia</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {environment === "test" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Email de prueba</Label>
                    <Input
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      placeholder="test@ejemplo.com"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Gossip mode + Copywriter style */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={gossipMode}
                    onCheckedChange={setGossipMode}
                  />
                  <Label className="text-xs cursor-pointer" onClick={() => setGossipMode(!gossipMode)}>
                    🍷 Incluir Gossip de Wall Street
                  </Label>
                  {gossipMode && (
                    <Badge variant="outline" className="text-[9px] text-pink-400 border-pink-400/30">
                      +Vanessa Drake
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-xs">✍️ Copywriter:</Label>
                  <Select value={copywriterStyle} onValueChange={(v: "technical" | "storyteller") => setCopywriterStyle(v)}>
                    <SelectTrigger className="h-8 text-xs w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical" className="text-xs">
                        ✍️ Sofía Hernández — Técnica
                      </SelectItem>
                      <SelectItem value="storyteller" className="text-xs">
                        🌟 Valentina Torres — Storyteller
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className={`text-[9px] ${copywriterStyle === "storyteller" ? "text-orange-400 border-orange-400/30" : "text-yellow-400 border-yellow-400/30"}`}>
                    {copywriterStyle === "storyteller" ? "Joven & Simple" : "Especializada"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs">Roles destinatarios</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.map(r => (
                      <Badge
                        key={r.value}
                        variant={selectedRoles.includes(r.value) ? "default" : "outline"}
                        className="cursor-pointer text-[10px]"
                        onClick={() => toggleRole(r.value)}
                      >
                        {r.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-2 shrink-0"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {generating ? "Generando con IA..." : "🧠 Preparar Newsletter"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Animation - full width below config */}
          <NewsletterAgentAnimation isGenerating={generating} />

          {/* ── Real-time Progress Panel ── */}
          {(generating || liveLogs.length > 0) && (
            <Card className="border-primary/30 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  Progreso de Generación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{currentStep}</span>
                    <span className="font-mono font-bold text-primary">{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-3" />
                </div>

                {/* Step indicators */}
                <div className="flex flex-wrap gap-1">
                  {AGENT_STEPS.map((step) => {
                    const isCompleted = progressPct > step.pct;
                    const isCurrent = progressPct >= step.pct - 5 && progressPct <= step.pct;
                    return (
                      <Badge
                        key={step.action}
                        variant={isCompleted ? "default" : "outline"}
                        className={`text-[9px] transition-all duration-300 ${
                          isCurrent ? "ring-2 ring-primary ring-offset-1 ring-offset-background animate-pulse" : ""
                        } ${isCompleted ? "bg-green-600" : ""}`}
                      >
                        {step.emoji} {step.agent}
                        {isCompleted && " ✓"}
                      </Badge>
                    );
                  })}
                </div>

                {/* Live log / bitácora */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Bitácora en tiempo real</Label>
                  <ScrollArea className="h-72 rounded-md border border-border/50 bg-background/50 p-2">
                    <div className="space-y-1.5">
                      {liveLogs.map((log, i) => (
                        <div
                          key={log.id || i}
                          className="flex items-start gap-2 text-[11px] animate-in fade-in slide-in-from-bottom-1 duration-300"
                        >
                          <span className="text-muted-foreground font-mono shrink-0 w-14">
                            {new Date(log.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          <span className="shrink-0">{log.agent_emoji}</span>
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{log.agent_name}</span>
                            <span className="text-muted-foreground"> — {log.action}</span>
                            {log.revision_notes && (
                              <span className="text-yellow-500 ml-1">⚠️ {log.revision_notes}</span>
                            )}
                            {log.output_summary && (
                              <p className="text-muted-foreground/70 mt-0.5 whitespace-pre-wrap break-words">{log.output_summary}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {liveLogs.length === 0 && generating && (
                        <p className="text-[10px] text-muted-foreground text-center py-4 animate-pulse">
                          Esperando primer agente...
                        </p>
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-4">
          <div className="space-y-3">
            {editions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay ediciones aún. Crea tu primer newsletter.
              </p>
            ) : editions.map(ed => {
              const st = STATUS_MAP[ed.status] || STATUS_MAP.draft;
              const Icon = st.icon;
              return (
                <Card key={ed.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium truncate">{ed.campaign_name}</h4>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {ed.environment === "test" ? "🧪 Test" : "🚀 Prod"}
                          </Badge>
                          <Badge className={`text-[10px] ${st.color} shrink-0`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {st.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(ed.created_at).toLocaleString("es")}
                          {ed.sent_count > 0 && ` • ${ed.sent_count} enviados`}
                          {ed.prediction_question && ` • 🎯 Con predicción`}
                          {ed.prediction_question && (
                            <>
                              {" • "}
                              <a
                                href={`https://bullfytech.online/newsletter-results/${ed.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                🔗 Landing Resultados
                              </a>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        {ed.content_json?.html && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => setPreviewEdition(ed)}>
                              <Eye className="w-3 h-3" /> Preview
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => { setSendDialogEdition(ed); setCustomEmails([]); setEmailInput(""); }}>
                              <Mail className="w-3 h-3" /> Enviar a
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => fetchLogs(ed.id)}>
                          <BarChart3 className="w-3 h-3" /> Agentes
                        </Button>
                        {(ed.status === "reviewing" || ed.status === "approved") && (
                          <Button size="sm" className="h-7 text-xs gap-1"
                            onClick={() => handleSend(ed.id)} disabled={sending}>
                            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Enviar
                          </Button>
                        )}
                        {ed.status === "sent" && ed.prediction_question && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => handleVerify(ed.id)}>
                            <RefreshCw className="w-3 h-3" /> Verificar
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar newsletter?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará "{ed.campaign_name}" y todos sus registros de agentes. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(ed.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Agents Curriculum Tab ── */}
        <TabsContent value="agents" className="mt-4">
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold">🧠 Equipo Multi-Agente de Newsletter</h3>
              <p className="text-xs text-muted-foreground mt-1">
                8 agentes profesionales contratados por Bullfy Brain para producir newsletters de clase mundial
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENT_PROFILES.map((agent) => (
                <Card key={agent.name} className="overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-md">
                  <div className="h-1.5" style={{ background: agent.color }} />
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 shadow-sm"
                        style={{ background: `${agent.color}20`, border: `2px solid ${agent.color}` }}
                      >
                        {agent.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-foreground">{agent.name}</h4>
                        <p className="text-[11px] font-medium text-primary">{agent.role}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{agent.nationality}</span>
                          <span className="text-[10px] text-muted-foreground">• {agent.age} años</span>
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3 h-3 text-muted-foreground shrink-0" />
                      <p className="text-[11px] font-medium text-foreground">{agent.title}</p>
                    </div>

                    {/* Experience */}
                    <div className="flex items-start gap-1.5">
                      <GraduationCap className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground">{agent.experience}</p>
                    </div>

                    {/* Background */}
                    <div className="flex items-start gap-1.5">
                      <Award className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {agent.background.map(b => (
                          <Badge key={b} variant="outline" className="text-[9px] py-0 h-4">{b}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Habilidades clave</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.skills.map(s => (
                          <Badge key={s} variant="secondary" className="text-[9px] py-0 h-4">{s}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Contribution */}
                    <div className="bg-muted/50 rounded-md p-2">
                      <p className="text-[10px] text-muted-foreground italic">"{agent.contribution}"</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewEdition} onOpenChange={() => setPreviewEdition(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {previewEdition?.campaign_name}
            </DialogTitle>
          </DialogHeader>
          {previewEdition?.content_json?.html && (
            <div className="bg-white rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewEdition.content_json.html}
                className="w-full min-h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          )}
          {previewEdition?.prediction_question && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">🎯 Predicción:</p>
              <p className="text-sm">{previewEdition.prediction_question}</p>
              <div className="flex gap-2 mt-2">
                {(previewEdition.prediction_options || []).map((o: any) => (
                  <Badge key={o.key} variant="outline">{o.key}: {o.label}</Badge>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Agent Logs Dialog */}
      <Dialog open={!!showLogs} onOpenChange={() => setShowLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>🤖 Actividad de Agentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {agentLogs.map((log, i) => (
              <div key={log.id || i} className="p-2 rounded-lg bg-muted/50 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span>{log.agent_emoji}</span>
                  <span className="font-medium">{log.agent_name}</span>
                  <Badge variant="outline" className="text-[9px]">{log.action}</Badge>
                  {log.iteration_number > 1 && (
                    <Badge variant="secondary" className="text-[9px]">Iteración {log.iteration_number}</Badge>
                  )}
                </div>
                {log.revision_notes && (
                  <p className="text-yellow-400 text-[10px] mb-1">⚠️ {log.revision_notes}</p>
                )}
                <p className="text-muted-foreground whitespace-pre-wrap break-words">{log.output_summary}</p>
              </div>
            ))}
            {agentLogs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin logs aún.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Custom Emails Dialog */}
      <Dialog open={!!sendDialogEdition} onOpenChange={() => setSendDialogEdition(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📧 Enviar Newsletter</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Enviar "<span className="font-medium">{sendDialogEdition?.campaign_name}</span>" a emails específicos.
          </p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="email@ejemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addEmail} disabled={!emailInput.trim()}>
                Agregar
              </Button>
            </div>
            {customEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customEmails.map(email => (
                  <Badge key={email} variant="secondary" className="text-xs gap-1 pr-1">
                    {email}
                    <button onClick={() => removeEmail(email)} className="ml-1 hover:text-destructive">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleSendCustomEmails}
              disabled={customEmails.length === 0 || sendingCustom}
            >
              {sendingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar a {customEmails.length} destinatario{customEmails.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsletterStudio;
