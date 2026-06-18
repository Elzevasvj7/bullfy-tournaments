import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Trophy, Wrench, Sparkles, Award, Clock, MessageCircle, CheckCircle, Download, RotateCcw, X, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useExperienceStore, LEVELS, STAGES } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";
import ContactFormDialog from "@/components/experience/ContactFormDialog";
import DownloadResultsDialog from "@/components/experience/DownloadResultsDialog";
import GamificationRoadmap from "@/components/experience/GamificationRoadmap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ALL_BADGES = [
  { key: "Primera simulación", icon: "🎯", hint: "Completa cualquier simulación en el Tools Hub" },
  { key: "Potencial detectado", icon: "📊", hint: "Usa el IB Success Score para analizar tu potencial" },
  { key: "Perfil analizado", icon: "🔍", hint: "Ejecuta el Revenue Simulator con tus datos reales" },
  { key: "Funnel construido", icon: "🏗️", hint: "Crea tu embudo en el Funnel Builder" },
  { key: "Lead calificado", icon: "⭐", hint: "Alcanza un Opportunity Score de 50 o más" },
];

const ExperienceDashboard = () => {
  const { level, badges, toolsUsed, simulationsCount, progressStage, opportunityScore, resetAll } = useExperienceStore();
  const { sessionId } = useExperienceSession();
  const [recentSims, setRecentSims] = useState<any[]>([]);
  const [contactRequested, setContactRequested] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [showDidYouKnow, setShowDidYouKnow] = useState(false);
  const progressPercent = ((progressStage + 1) / STAGES.length) * 100;
  const levelIndex = LEVELS.indexOf(level as any);

  useEffect(() => {
    const timer = setTimeout(() => setShowDidYouKnow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    supabase
      .from("experience_simulations")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setRecentSims(data); });
  }, [sessionId]);

  const ContactCTA = ({ size = "sm", className = "" }: { size?: "sm" | "default"; className?: string }) => {
    if (contactRequested) {
      return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 ${className}`}>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-xs text-green-400 font-medium">¡Un Bullfy Specialist te contactará pronto!</span>
        </div>
      );
    }
    return (
      <Button
        size={size}
        onClick={() => setShowContactForm(true)}
        className={`bg-gradient-brand shadow-brand animate-fade-in ${size === "sm" ? "text-[10px] h-6 px-2" : "text-sm"} ${className}`}
      >
        <MessageCircle className={`mr-1 ${size === "sm" ? "w-3 h-3" : "w-4 h-4"}`} />
        Contacta un Bullfy Specialist
      </Button>
    );
  };

  const DownloadCTA = ({ size = "sm", className = "" }: { size?: "sm" | "default"; className?: string }) => {
    if (downloadRequested) {
      return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 ${className}`}>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-xs text-green-400 font-medium">¡Resultados descargados!</span>
        </div>
      );
    }
    return (
      <Button
        size={size}
        variant="outline"
        onClick={() => setShowDownloadDialog(true)}
        className={`border-primary/30 text-primary hover:bg-primary/10 animate-fade-in ${size === "sm" ? "text-[10px] h-6 px-2" : "text-sm"} ${className}`}
      >
        <Download className={`mr-1 ${size === "sm" ? "w-3 h-3" : "w-4 h-4"}`} />
        Descarga mis resultados
      </Button>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Tu Dashboard</h1>
          <p className="text-muted-foreground">Revisa tu progreso y resultados de simulaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadCTA size="default" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <RotateCcw className="w-4 h-4 mr-1" />
                Reiniciar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Reiniciar todo el progreso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrarán todas tus simulaciones, badges, nivel y progreso. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={resetAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, reiniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20 col-span-2 md:col-span-1">
          <CardContent className="pt-5 text-center space-y-2">
            <Sparkles className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-3xl font-bold" style={{ color: '#D4AF37' }}>{opportunityScore}<span className="text-sm text-muted-foreground">/100</span></p>
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Opportunity Score</p>
            {opportunityScore < 50 && (
              <p className="text-[10px] text-muted-foreground/70 italic">💡 Usa más herramientas y haz simulaciones para subir tu score</p>
            )}
            {opportunityScore >= 50 && opportunityScore < 80 && (
              <p className="text-[10px] italic" style={{ color: '#D4AF37' }}>🔥 Buen progreso — prueba el Empire Builder o Success Score</p>
            )}
            {opportunityScore >= 60 && <ContactCTA />}
            {opportunityScore >= 80 && (
              <p className="text-[10px] italic" style={{ color: '#D4AF37' }}>🏆 Score élite — tu perfil merece atención de un Bullfy Specialist</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-5 text-center">
            <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{level}</p>
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Nivel</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-5 text-center">
            <BarChart3 className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{simulationsCount}</p>
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Simulaciones</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-5 text-center">
            <Wrench className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{toolsUsed.length}</p>
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Herramientas</p>
          </CardContent>
        </Card>
      </div>

      <GamificationRoadmap />

      {/* Guided CTA to tools - top */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">🚀 Utiliza las herramientas para tu progreso hacia la conquista!</p>
            <p className="text-sm text-muted-foreground">
              {level === "Conquista Imperial"
                ? "¡Has alcanzado el nivel máximo! Contacta a un Specialist para dar el siguiente paso."
                : `Avanza hacia "${LEVELS[LEVELS.indexOf(level as any) + 1] || "Conquista Imperial"}" completando más simulaciones`}
            </p>
          </div>
          <Link to="/IbBullfyExperience/tools">
            <Button size="lg" className="bg-gradient-brand shadow-brand whitespace-nowrap">
              <Wrench className="w-4 h-4 mr-2" />
              Ir a Herramientas
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2"><Award className="w-5 h-5" />Badges</span>
              <span className="text-xs text-muted-foreground font-normal">{badges.length}/{ALL_BADGES.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {ALL_BADGES.map((b) => {
                const earned = badges.includes(b.key);
                return (
                  <div key={b.key} className={`flex flex-col gap-1 p-3 rounded-lg border transition-all ${earned ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-border/30"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl ${earned ? "" : "grayscale opacity-50"}`}>{b.icon}</span>
                      <span className={`text-xs font-medium ${earned ? "text-foreground" : "text-muted-foreground"}`}>{b.key}</span>
                    </div>
                    {!earned && (
                      <p className="text-[10px] text-muted-foreground/70 italic pl-7">💡 {b.hint}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 text-center space-y-2">
              <ContactCTA size="default" />
              <DownloadCTA size="default" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" />Simulaciones recientes</CardTitle></CardHeader>
          <CardContent>
            {recentSims.length > 0 ? (
              <div className="space-y-2">
                {recentSims.map((sim) => (
                  <div key={sim.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
                    <span className="text-sm font-medium capitalize">{sim.tool_name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(sim.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                <div className="pt-3 text-center">
                  <DownloadCTA size="default" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aún no tienes simulaciones</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guided CTA to tools */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">🚀 Utiliza las herramientas para tu progreso hacia la conquista!</p>
            <p className="text-sm text-muted-foreground">
              {level === "Conquista Imperial"
                ? "¡Has alcanzado el nivel máximo! Contacta a un Specialist para dar el siguiente paso."
                : `Avanza hacia "${LEVELS[LEVELS.indexOf(level as any) + 1] || "Conquista Imperial"}" completando más simulaciones`}
            </p>
          </div>
          <Link to="/IbBullfyExperience/tools">
            <Button size="lg" className="bg-gradient-brand shadow-brand whitespace-nowrap">
              <Wrench className="w-4 h-4 mr-2" />
              Ir a Herramientas
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <DownloadCTA size="default" />
        <ContactCTA size="default" />
      </div>

      <ContactFormDialog
        open={showContactForm}
        onOpenChange={setShowContactForm}
        onSuccess={() => setContactRequested(true)}
      />
      <DownloadResultsDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onSuccess={() => setDownloadRequested(true)}
      />

      {/* "¿Sabías que?" popup */}
      <AnimatePresence>
        {showDidYouKnow && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm"
          >
            <Card className="border-primary/30 bg-card shadow-xl">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Info className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">¿Sabías que?</p>
                  <p className="text-sm text-foreground">
                    Bullfy pertenece al holding empresarial <strong>Wowinx</strong>.
                  </p>
                  <a
                    href="https://www.wowinx.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-primary hover:underline font-medium"
                  >
                    www.wowinx.com →
                  </a>
                </div>
                <button
                  onClick={() => setShowDidYouKnow(false)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExperienceDashboard;
