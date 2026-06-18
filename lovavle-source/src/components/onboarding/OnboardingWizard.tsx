import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, FileText, Loader2, Download, ScrollText, FlaskConical, BarChart3, Home, PlusCircle, Users, Settings2 as Settings2Icon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import StepIndicator from "./StepIndicator";
import StepInfoGeneral from "./steps/StepInfoGeneral";
import StepLugarOperacion from "./steps/StepLugarOperacion";
import StepSubIBs from "./steps/StepSubIBs";
import StepModeloNegocio from "./steps/StepModeloNegocio";
import StepTipoAcuerdo from "./steps/StepTipoAcuerdo";
import StepRebates from "./steps/StepRebates";
import StepComisionLote from "./steps/StepComisionLote";
import StepCPA from "./steps/StepCPA";
import StepHibrido from "./steps/StepHibrido";
import StepReglasCPA from "./steps/StepReglasCPA";
import StepPropFirm from "./steps/StepPropFirm";
import StepCuentas from "./steps/StepCuentas";
import StepPerformance from "./steps/StepPerformance";
import StepResumen from "./steps/StepResumen";
import StepKickoffVideo from "./steps/StepKickoffVideo";
import { saveOnboardingToDB } from "@/services/saveOnboarding";
import { updateIBConditions } from "@/services/updateIBConditions";
import { generateTechnicalReportPDF } from "@/services/generateTechnicalReport";
import { generateAgreementPDF, generateSubIBAgreementPDF } from "@/services/generateAgreement";
import { generatePerformanceReportPDF } from "@/services/generatePerformanceReport";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { supabase } from "@/integrations/supabase/client";

interface StepDef {
  id: string;
  label: string;
  component: React.ComponentType;
  condition?: boolean;
}

const OnboardingWizard = () => {
  const {
    currentStep, formData, isTestMode,
    savedIbId, testCompleted, downloadedReports,
    editMode, editingIbId,
    setCurrentStep, nextStep, prevStep, resetForm, setTestMode,
    setSavedIbId, setTestCompleted, addDownloadedReport,
  } = useOnboardingStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [generatingPerformance, setGeneratingPerformance] = useState(false);
  const [generatingSubIBAgreement, setGeneratingSubIBAgreement] = useState<number | null>(null);

  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";
  const showRebates = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Rebates";
  const showCPA = showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA";
  const showHibrido = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido";
  const showReglasCPA = showCPA || showHibrido;

  const allSteps: StepDef[] = useMemo(() => [
    { id: "info", label: "Info", component: StepInfoGeneral },
    { id: "lugar", label: "Ubicación", component: StepLugarOperacion },
    { id: "sub_ibs", label: "Sub IBs", component: StepSubIBs },
    { id: "modelo", label: "Modelo", component: StepModeloNegocio },
    { id: "acuerdo", label: "Acuerdo", component: StepTipoAcuerdo, condition: showBrokeraje },
    { id: "rebates", label: "Rebates", component: StepRebates, condition: showRebates },
    { id: "comision_lote", label: "Comisión/Lote", component: StepComisionLote, condition: showBrokeraje },
    { id: "cpa", label: "CPA", component: StepCPA, condition: showCPA },
    { id: "hibrido", label: "Híbrido", component: StepHibrido, condition: showHibrido },
    { id: "reglas", label: "Reglas", component: StepReglasCPA, condition: showReglasCPA },
    { id: "propfirm", label: "PropFirm", component: StepPropFirm, condition: showPropFirm },
    { id: "cuentas", label: "Cuentas", component: StepCuentas },
    { id: "performance", label: "Performance", component: StepPerformance },
    { id: "kickoff", label: "Kick-off", component: StepKickoffVideo },
    { id: "resumen", label: "Resumen", component: StepResumen },
  ], [showBrokeraje, showPropFirm, showRebates, showCPA, showHibrido, showReglasCPA]);

  const steps = useMemo(
    () => allSteps.filter((s) => s.condition === undefined || s.condition),
    [allSteps]
  );

  const safeStep = Math.min(currentStep, steps.length - 1);
  const CurrentStepComponent = steps[safeStep]?.component;
  const isLastStep = safeStep === steps.length - 1;
  const isFinished = isTestMode ? testCompleted : !!savedIbId;

  const validateCurrentStep = (): boolean => {
    const step = steps[safeStep];
    if (step.id === "info") {
      const missingBase = !formData.tipo_persona || !formData.nombre_bd || !formData.nombre_ib || !formData.correo_ib || !formData.tipo_id;
      const missingPersona = formData.tipo_persona === 'Persona Física' && !formData.id_ib;
      const missingEmpresa = formData.tipo_persona === 'Empresa' && !formData.direccion_empresa;
      if (missingBase || missingPersona || missingEmpresa) {
        toast({ title: "Campos requeridos", description: "Completa todos los campos de información general", variant: "destructive" });
        return false;
      }
    }
    if (step.id === "lugar" && !formData.lugar_operacion) {
      toast({ title: "Campo requerido", description: "Selecciona el lugar de operación", variant: "destructive" });
      return false;
    }
    if (step.id === "modelo" && !formData.modelo_negocio) {
      toast({ title: "Campo requerido", description: "Selecciona el modelo de negocio", variant: "destructive" });
      return false;
    }
    if (step.id === "acuerdo" && !formData.tipo_acuerdo_brokeraje) {
      toast({ title: "Campo requerido", description: "Selecciona el tipo de acuerdo", variant: "destructive" });
      return false;
    }
    if (step.id === "kickoff" && formData.tiene_video_kickoff && !formData.video_kickoff_path) {
      toast({ title: "Video requerido", description: "Indicaste que hay video de Kick-off. Súbelo antes de continuar.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (!isLastStep) nextStep();
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión", variant: "destructive" });
      return;
    }

    if (isTestMode) {
      setTestCompleted(true);
      toast({
        title: "🧪 Test completado",
        description: `Modo test — nada fue guardado en la base de datos.`,
      });
      return;
    }

    setSaving(true);
    try {
      if (editMode && editingIbId) {
        // Edit mode: update existing IB conditions
        const result = await updateIBConditions(editingIbId, formData);
        setSavedIbId(editingIbId);
        toast({
          title: "✅ Condiciones actualizadas",
          description: `Versión ${result.version} guardada. ${result.reportCount} reportes generados.`,
        });
      } else {
        // New IB mode
        const ibId = await saveOnboardingToDB(formData, user.id);
        setSavedIbId(ibId);
        toast({
          title: "✅ IB guardado exitosamente",
          description: `El IB ${formData.nombre_ib} ha sido registrado.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /** Helper: fetch existing report from DB by type and ib_id */
  const fetchExistingReport = async (ibId: string, reportType: string, nombreIb?: string) => {
    let query = supabase
      .from("reports")
      .select("report_number, data")
      .eq("ib_id", ibId)
      .eq("report_type", reportType)
      .order("created_at", { ascending: false })
      .limit(1);
    if (nombreIb) query = query.eq("nombre_ib", nombreIb);
    const { data } = await query.maybeSingle();
    return data;
  };

  const handleGeneratePDF = async () => {
    const logo = await getLogoBase64();
    if (isTestMode) {
      const testReportNumber = `TEST-${Date.now().toString().slice(-6)}`;
      const doc = generateTechnicalReportPDF(formData, testReportNumber, "TEST", logo);
      doc.save(`IB_Technical_Report_TEST_${formData.nombre_ib.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "🧪 Reporte Test generado", description: `Technical Report ${testReportNumber} descargado (no guardado en BD).` });
      addDownloadedReport("technical");
      return;
    }

    if (!savedIbId) return;
    setGeneratingPdf(true);
    try {
      const existing = await fetchExistingReport(savedIbId, "technical");
      const reportNumber = existing?.report_number || "N/A";
      const doc = generateTechnicalReportPDF(formData, reportNumber, savedIbId, logo, editMode);
      doc.save(`IB_Technical_Report_${formData.nombre_ib.replace(/\s+/g, "_")}_${reportNumber}.pdf`);
      toast({ title: "📄 Reporte descargado", description: `Technical Report ${reportNumber} descargado.` });
      addDownloadedReport("technical");
    } catch (err: any) {
      toast({ title: "Error generando PDF", description: err.message || "Error inesperado", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenerateAgreement = async () => {
    const logo = await getLogoBase64();
    if (isTestMode) {
      const testReportNumber = `TEST-${Date.now().toString().slice(-6)}`;
      const doc = generateAgreementPDF(formData, testReportNumber, "TEST", logo);
      doc.save(`IB_Agreement_TEST_${formData.nombre_ib.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "🧪 Agreement Test generado", description: `Agreement ${testReportNumber} descargado (no guardado en BD).` });
      addDownloadedReport("agreement");
      return;
    }

    if (!savedIbId) return;
    setGeneratingAgreement(true);
    try {
      const existing = await fetchExistingReport(savedIbId, "agreement", formData.nombre_ib);
      const reportNumber = existing?.report_number || "N/A";
      const doc = generateAgreementPDF(formData, reportNumber, savedIbId, logo);
      doc.save(`IB_Agreement_${formData.nombre_ib.replace(/\s+/g, "_")}_${reportNumber}.pdf`);
      toast({ title: "📜 Agreement descargado", description: `IB Agreement ${reportNumber} descargado.` });
      addDownloadedReport("agreement");
    } catch (err: any) {
      toast({ title: "Error generando Agreement", description: err.message || "Error inesperado", variant: "destructive" });
    } finally {
      setGeneratingAgreement(false);
    }
  };

  const handleGeneratePerformance = async () => {
    const logo = await getLogoBase64();
    if (isTestMode) {
      const testReportNumber = `TEST-${Date.now().toString().slice(-6)}`;
      const doc = generatePerformanceReportPDF(formData, testReportNumber, "TEST", logo);
      doc.save(`IB_Performance_TEST_${formData.nombre_ib.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "🧪 Performance Test generado", description: `Performance Report ${testReportNumber} descargado (no guardado en BD).` });
      addDownloadedReport("performance");
      return;
    }

    if (!savedIbId) return;
    setGeneratingPerformance(true);
    try {
      const existing = await fetchExistingReport(savedIbId, "performance");
      const reportNumber = existing?.report_number || "N/A";
      const doc = generatePerformanceReportPDF(formData, reportNumber, savedIbId, logo);
      doc.save(`IB_Performance_${formData.nombre_ib.replace(/\s+/g, "_")}_${reportNumber}.pdf`);
      toast({ title: "📊 Performance descargado", description: `Performance Report ${reportNumber} descargado.` });
      addDownloadedReport("performance");
    } catch (err: any) {
      toast({ title: "Error generando Performance", description: err.message || "Error inesperado", variant: "destructive" });
    } finally {
      setGeneratingPerformance(false);
    }
  };

  const handleGenerateSubIBAgreement = async (subIBIndex: number) => {
    const subIB = formData.sub_ibs[subIBIndex];
    if (!subIB) return;

    const logo = await getLogoBase64();
    const reportKey = `sub_agreement_${subIBIndex}`;

    if (isTestMode) {
      const testReportNumber = `TEST-${Date.now().toString().slice(-6)}`;
      const doc = generateSubIBAgreementPDF(formData, subIB, testReportNumber, "TEST", logo);
      doc.save(`IB_Agreement_SubIB_TEST_${subIB.nombre.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "🧪 Sub IB Agreement Test", description: `Agreement para ${subIB.nombre} descargado (no guardado en BD).` });
      addDownloadedReport(reportKey);
      return;
    }

    if (!savedIbId) return;
    setGeneratingSubIBAgreement(subIBIndex);
    try {
      const existing = await fetchExistingReport(savedIbId, "agreement", subIB.nombre);
      const reportNumber = existing?.report_number || "N/A";
      const doc = generateSubIBAgreementPDF(formData, subIB, reportNumber, savedIbId, logo);
      doc.save(`IB_Agreement_SubIB_${subIB.nombre.replace(/\s+/g, "_")}_${reportNumber}.pdf`);
      toast({ title: "📜 Sub IB Agreement descargado", description: `Agreement para ${subIB.nombre} — ${reportNumber} descargado.` });
      addDownloadedReport(reportKey);
    } catch (err: any) {
      toast({ title: "Error generando Sub IB Agreement", description: err.message || "Error inesperado", variant: "destructive" });
    } finally {
      setGeneratingSubIBAgreement(null);
    }
  };

  const handleReset = () => {
    resetForm();
  };

  const handleGoHome = () => {
    const wasEditMode = editMode;
    resetForm();
    navigate(wasEditMode ? "/deals" : "/");
  };

  const hasSubIBs = formData.tiene_sub_ibs && formData.sub_ibs.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
          <Settings2Icon className="w-4 h-4 shrink-0" />
          <span><strong>Modo Edición</strong> — Estás modificando las condiciones de <strong>{formData.nombre_ib}</strong>. Los cambios generarán una nueva versión y nuevos reportes.</span>
        </div>
      )}

      {/* Test/Real toggle — only before finishing and not in edit mode */}
      {!isFinished && !editMode && (
        <div className="flex items-center justify-end gap-3">
          <Label htmlFor="test-mode" className="text-sm text-muted-foreground flex items-center gap-1.5 cursor-pointer">
            <FlaskConical className="w-4 h-4" />
            Modo Test
          </Label>
          <Switch
            id="test-mode"
            checked={isTestMode}
            onCheckedChange={setTestMode}
          />
        </div>
      )}

      {/* Test mode banner */}
      {isTestMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent/30 bg-accent/10 text-accent text-sm">
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span><strong>Modo Test activo</strong> — Los datos no se guardarán en la base de datos.</span>
        </div>
      )}

      <StepIndicator
        steps={steps.map((s) => s.label)}
        currentStep={safeStep}
        onStepClick={(step) => setCurrentStep(step)}
      />

      <div className="bg-gradient-card rounded-xl border border-border shadow-card p-6 md:p-8 min-h-[400px]">
        {CurrentStepComponent && <CurrentStepComponent />}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={safeStep === 0 || isFinished}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </Button>

        {isLastStep ? (
          <div className="flex gap-3">
            {!isFinished ? (
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {saving ? "Guardando..." : isTestMode ? "Completar Test" : editMode ? "Actualizar Condiciones" : "Guardar IB"}
              </Button>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Main reports */}
                <div className="flex flex-wrap gap-3 items-center">
                  <Button
                    onClick={handleGeneratePDF}
                    disabled={generatingPdf}
                    className={`gap-2 ${downloadedReports.includes("technical") ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"}`}
                  >
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {generatingPdf ? "Generando..." : downloadedReports.includes("technical") ? "✓ Technical Report" : "Technical Report"}
                  </Button>
                  <Button
                    onClick={handleGenerateAgreement}
                    disabled={generatingAgreement}
                    className={`gap-2 ${downloadedReports.includes("agreement") ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                    variant={downloadedReports.includes("agreement") ? "default" : "outline"}
                  >
                    {generatingAgreement ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScrollText className="w-4 h-4" />}
                    {generatingAgreement ? "Generando..." : downloadedReports.includes("agreement") ? "✓ Agreement" : "Agreement"}
                  </Button>
                  {formData.generar_performance && (
                    <Button
                      onClick={handleGeneratePerformance}
                      disabled={generatingPerformance}
                      className={`gap-2 ${downloadedReports.includes("performance") ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                      variant={downloadedReports.includes("performance") ? "default" : "outline"}
                    >
                      {generatingPerformance ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                      {generatingPerformance ? "Generando..." : downloadedReports.includes("performance") ? "✓ Performance" : "Performance"}
                    </Button>
                  )}

                  <div className="flex gap-2 border-l border-border pl-3 ml-1">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Nuevo IB
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleGoHome}
                      className="gap-2 text-muted-foreground"
                    >
                      <Home className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </div>
                </div>

                {/* Sub IB Agreements */}
                {hasSubIBs && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Agreements para Sub IBs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {formData.sub_ibs.map((subIB, i) => {
                        const reportKey = `sub_agreement_${i}`;
                        const isGenerating = generatingSubIBAgreement === i;
                        const isDownloaded = downloadedReports.includes(reportKey);
                        return (
                          <Button
                            key={i}
                            size="sm"
                            onClick={() => handleGenerateSubIBAgreement(i)}
                            disabled={isGenerating}
                            className={`gap-1.5 text-xs ${isDownloaded ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                            variant={isDownloaded ? "default" : "outline"}
                          >
                            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScrollText className="w-3.5 h-3.5" />}
                            {isGenerating ? "Generando..." : isDownloaded ? `✓ ${subIB.nombre}` : subIB.nombre}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={handleNext}
            className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
          >
            Siguiente
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
