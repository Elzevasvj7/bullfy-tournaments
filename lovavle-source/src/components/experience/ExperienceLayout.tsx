import { ReactNode, useState, useEffect, useRef } from "react";
import { Monitor } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Home, Wrench, BarChart3, Sparkles, ArrowLeft, MessageCircle, CheckCircle, Download, UserPlus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useExperienceStore, STAGES } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import ContactFormDialog from "@/components/experience/ContactFormDialog";
import DownloadResultsDialog from "@/components/experience/DownloadResultsDialog";
import BenefitMilestoneDialog from "@/components/experience/BenefitMilestoneDialog";
import logoSrc from "@/assets/logo-bullfy.png";

const navItems = [
  { to: "/IbBullfyExperience", icon: Home, label: "Inicio", exact: true },
  { to: "/IbBullfyExperience/dashboard", icon: BarChart3, label: "Dashboard", exact: false },
  { to: "/IbBullfyExperience/tools", icon: Wrench, label: "Herramientas", exact: false },
  { to: "/IbBullfyExperience/historial", icon: History, label: "Historial", exact: false },
  { to: "/IbBullfyExperience/contacto", icon: UserPlus, label: "Contacto", exact: false },
];

const ExperienceLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { level, progressStage, currentMessage, opportunityScore, simulationsCount, currentBenefitMilestones, closeBenefitMilestone, resetSeenMilestones } = useExperienceStore();
  useExperienceSession();
  const [contactRequested, setContactRequested] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadRequested, setDownloadRequested] = useState(false);
  const prevPathRef = useRef(location.pathname);

  // Reset seen milestones when navigating back to dashboard or tools hub
  useEffect(() => {
    const prev = prevPathRef.current;
    const curr = location.pathname;
    prevPathRef.current = curr;

    const isToolPage = (p: string) => p.startsWith("/IbBullfyExperience/tools/");
    const isHubOrDash = (p: string) =>
      p === "/IbBullfyExperience" ||
      p === "/IbBullfyExperience/dashboard" ||
      p === "/IbBullfyExperience/tools";

    if (isToolPage(prev) && isHubOrDash(curr)) {
      resetSeenMilestones();
    }
  }, [location.pathname, resetSeenMilestones]);

  const progressPercent = ((progressStage + 1) / STAGES.length) * 100;
  const showProgressCTA = progressStage >= 2 || opportunityScore >= 60;

  const CTAButton = ({ size = "sm" }: { size?: "sm" | "default" }) => {
    if (contactRequested) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span className="text-[10px] text-green-400 font-medium">¡Te contactaremos pronto!</span>
        </div>
      );
    }
    return (
      <Button
        size={size}
        onClick={() => setShowContactForm(true)}
        className={`bg-gradient-brand shadow-brand whitespace-nowrap animate-fade-in ${size === "sm" ? "text-[10px] h-6 px-2" : ""}`}
      >
        <MessageCircle className={`mr-1 ${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
        Contacta un Bullfy Specialist
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Bullfy" className="h-7" />
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest hidden sm:block">
                IB Experience
              </span>
            </div>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-primary">{level}</span>
              </div>
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Sistema</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="h-1.5 flex-1" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {STAGES[progressStage]}
            </span>
            {showProgressCTA && <CTAButton />}
          </div>
        </div>
      </header>

      {progressStage > 0 && (
        <div className="bg-primary/5 border-b border-primary/10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-center gap-4">
            <p className="text-lg md:text-xl font-semibold italic animate-fade-in" style={{ color: '#D4AF37' }}>
              ✨ {currentMessage}
            </p>
            <div className="shrink-0 flex items-center gap-2">
              {simulationsCount > 0 && !downloadRequested && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDownloadDialog(true)}
                  className="border-primary/30 text-primary hover:bg-primary/10 text-[10px] h-6 px-2"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Descarga resultados
                </Button>
              )}
              <CTAButton />
            </div>
          </div>
        </div>
      )}

      {/* Mobile notice */}
      <div className="md:hidden mx-4 mt-4 mb-0 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
        <Monitor className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">Para una experiencia óptima mira el Experience desde un computador</p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

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

      <BenefitMilestoneDialog
        open={currentBenefitMilestones.length > 0}
        thresholds={currentBenefitMilestones}
        onOpenChange={(open) => {
          if (!open) closeBenefitMilestone();
        }}
      />
    </div>
  );
};

export default ExperienceLayout;
