import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { ArrowLeft, ArrowRight, Loader2, Download, ScrollText, FileText, Home, Copy } from "lucide-react";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepSelectMasterIB from "./steps/StepSelectMasterIB";
import StepSubIBInfo from "./steps/StepSubIBInfo";
import StepSubIBCompensation from "./steps/StepSubIBCompensation";
import StepSubIBSummary from "./steps/StepSubIBSummary";
import { generateSubIBAgreementPDF, type SubIBCompensation } from "@/services/generateAgreement";
import { generateTechnicalReportPDF } from "@/services/generateTechnicalReport";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { loadIBFormData } from "@/services/loadIBFormData";
import type { OnboardingFormData, SubIB } from "@/stores/onboardingStore";

export interface MasterIBOption {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  nombre_bd: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
  lugar_operacion: string;
}

export interface SubIBFormData {
  master_ib_id: string;
  master_ib: MasterIBOption | null;
  masterFormData: OnboardingFormData | null;
  // Sub IB personal info
  nombre: string;
  correo: string;
  tipo_id: string;
  id_documento: string;
  // Compensation allocation (rebates)
  dolares_por_lote_sub_ib: number;
  // CPA allocation
  cpa_allocation: { rango_deposito: string; dolares_asignados: number }[];
  // Hybrid allocation
  hybrid_lote_sub_ib: number;
  hybrid_cpa_allocation: { rango_deposito: string; dolares_asignados: number }[];
  // PropFirm allocation
  propfirm_comision_sub_ib: number;
}

const initialSubIBForm: SubIBFormData = {
  master_ib_id: "",
  master_ib: null,
  masterFormData: null,
  nombre: "",
  correo: "",
  tipo_id: "",
  id_documento: "",
  dolares_por_lote_sub_ib: 0,
  cpa_allocation: [],
  hybrid_lote_sub_ib: 0,
  hybrid_cpa_allocation: [],
  propfirm_comision_sub_ib: 0,
};

const steps = [
  { id: "master", label: "Master IB" },
  { id: "info", label: "Info Sub IB" },
  { id: "compensation", label: "Compensación" },
  { id: "summary", label: "Resumen" },
];

const SUB_IB_WIZARD_STORAGE_KEY = "sub_ib_wizard_state_v1";

const SubIBWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SubIBFormData>({ ...initialSubIBForm });
  const [saving, setSaving] = useState(false);
  const [savedSubIBId, setSavedSubIBId] = useState<string | null>(null);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [generatingTechnical, setGeneratingTechnical] = useState(false);
  const [downloadedReports, setDownloadedReports] = useState<string[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [hydratedState, setHydratedState] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SUB_IB_WIZARD_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        currentStep?: number;
        formData?: SubIBFormData;
        savedSubIBId?: string | null;
        downloadedReports?: string[];
      };

      if (typeof parsed.currentStep === "number") {
        setCurrentStep(Math.max(0, Math.min(parsed.currentStep, steps.length - 1)));
      }

      if (parsed.formData) {
        setFormData({ ...initialSubIBForm, ...parsed.formData });
      }

      if (typeof parsed.savedSubIBId === "string" || parsed.savedSubIBId === null) {
        setSavedSubIBId(parsed.savedSubIBId ?? null);
      }

      if (Array.isArray(parsed.downloadedReports)) {
        setDownloadedReports(parsed.downloadedReports.filter((r) => r === "agreement" || r === "technical"));
      }
    } catch {
      sessionStorage.removeItem(SUB_IB_WIZARD_STORAGE_KEY);
    } finally {
      setHydratedState(true);
    }
  }, []);

  useEffect(() => {
    if (!hydratedState) return;

    sessionStorage.setItem(
      SUB_IB_WIZARD_STORAGE_KEY,
      JSON.stringify({
        currentStep,
        formData,
        savedSubIBId,
        downloadedReports,
      })
    );
  }, [hydratedState, currentStep, formData, savedSubIBId, downloadedReports]);

  const updateForm = (data: Partial<SubIBFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const showSupportError = (title: string, error: unknown) => {
    const message = error instanceof Error ? error.message : "Error inesperado";
    const details = `${title}\n${message}\nTimestamp: ${new Date().toISOString()}`;

    toast({
      title,
      description: message,
      variant: "destructive",
      action: (
        <ToastAction
          altText="Copiar error"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(details);
              toast({ title: "Error copiado", description: "Compártelo con soporte." });
            } catch {
              toast({ title: "No se pudo copiar", variant: "destructive" });
            }
          }}
        >
          <Copy className="h-4 w-4" /> Copiar
        </ToastAction>
      ),
    });
  };

  const handleSelectMasterIB = async (ib: MasterIBOption) => {
    updateForm({ master_ib_id: ib.id, master_ib: ib });
    setLoadingMaster(true);
    try {
      const masterData = await loadIBFormData(ib.id);
      updateForm({ masterFormData: masterData });

      // Initialize CPA allocation from master's CPA config
      if (masterData.cpa_config.length > 0) {
        updateForm({
          cpa_allocation: masterData.cpa_config.map((c) => ({
            rango_deposito: c.rango_deposito,
            dolares_asignados: 0,
          })),
        });
      }
      // Initialize Hybrid CPA allocation
      if (masterData.hybrid_config.length > 0) {
        updateForm({
          hybrid_cpa_allocation: masterData.hybrid_config.map((h) => ({
            rango_deposito: h.rango_deposito,
            dolares_asignados: 0,
          })),
        });
      }
    } catch (err: any) {
      showSupportError("Error cargando Master IB", err);
    } finally {
      setLoadingMaster(false);
    }
  };

  const validateStep = (): boolean => {
    const step = steps[currentStep];
    if (step.id === "master" && !formData.master_ib_id) {
      toast({ title: "Selecciona un Master IB", variant: "destructive" });
      return false;
    }
    if (step.id === "info") {
      if (!formData.nombre || !formData.correo || !formData.tipo_id || !formData.id_documento) {
        toast({ title: "Completa todos los campos del Sub IB", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handlePrev = () => setCurrentStep((s) => Math.max(0, s - 1));

  const isLastStep = currentStep === steps.length - 1;
  const isFinished = !!savedSubIBId;

  const handleSubmit = async () => {
    if (!user || !formData.master_ib_id) return;
    setSaving(true);
    try {
      // 1. Insert sub_ib record with compensation data
      const { data: subIBData, error: subIBError } = await supabase
        .from("sub_ibs")
        .insert({
          ib_id: formData.master_ib_id,
          nombre: formData.nombre,
          correo: formData.correo,
          tipo_id: formData.tipo_id,
          id_documento: formData.id_documento,
          dolares_por_lote: formData.dolares_por_lote_sub_ib || null,
        })
        .select("id")
        .single();

      if (subIBError) throw new Error(`Error guardando Sub IB: ${subIBError.message}`);
      setSavedSubIBId(subIBData.id);

      // 2. Update master IB to have tiene_sub_ibs = true
      await supabase.from("ibs").update({ tiene_sub_ibs: true }).eq("id", formData.master_ib_id);

      toast({
        title: "✅ Sub IB creado",
        description: `${formData.nombre} vinculado a ${formData.master_ib?.nombre_ib}`,
      });
    } catch (err: any) {
      showSupportError("Error guardando Sub IB", err);
    } finally {
      setSaving(false);
    }
  };

  const buildSubIBFormData = (): OnboardingFormData | null => {
    if (!formData.masterFormData) return null;
    const master = formData.masterFormData;
    const subData: OnboardingFormData = {
      ...master,
      nombre_ib: formData.nombre,
      correo_ib: formData.correo,
      tipo_id: formData.tipo_id,
      id_ib: formData.id_documento,
      tiene_sub_ibs: false,
      sub_ibs: [],
      // Override with sub IB's specific allocation
      nuevo_dolar_ib_global: formData.dolares_por_lote_sub_ib || master.nuevo_dolar_ib_global,
    };

    // PropFirm: if master has niveles, keep them; if direct, clear propfirm so Sub IB gets nothing
    if (master.propfirm_cobro_tipo !== "niveles") {
      subData.propfirm_config = [];
    }

    return subData;
  };

  const downloadPdfFile = (doc: any, filename: string) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleGenerateAgreement = async () => {
    if (!formData.masterFormData) return;
    setGeneratingAgreement(true);
    try {
      const logo = await getLogoBase64();
      const subIB: SubIB = {
        nombre: formData.nombre,
        correo: formData.correo,
        tipo_id: formData.tipo_id,
        id_documento: formData.id_documento,
        es_master_ib: false,
        master_ib_numero: null,
        dolares_por_lote: formData.dolares_por_lote_sub_ib || null,
      };

      if (savedSubIBId) {
        const { data: reportData, error: reportError } = await supabase
          .from("reports")
          .insert({
            ib_id: formData.master_ib_id,
            report_type: "agreement",
            nombre_bd: formData.masterFormData.nombre_bd,
            nombre_ib: formData.nombre,
            data: {
              ...formData.masterFormData,
              _is_sub_ib: true,
              _sub_ib_agreement_for: formData.nombre,
              _sub_ib_correo: formData.correo,
              _parent_ib_name: formData.masterFormData.nombre_ib,
              _parent_ib_correo: formData.masterFormData.correo_ib,
              _sub_ib_dolares_lote: formData.dolares_por_lote_sub_ib,
              _sub_ib_cpa_allocation: formData.cpa_allocation,
              _sub_ib_hybrid_lote: formData.hybrid_lote_sub_ib,
              _sub_ib_hybrid_cpa: formData.hybrid_cpa_allocation,
              _sub_ib_propfirm_comision: formData.propfirm_comision_sub_ib,
            } as any,
            report_number: "TEMP",
          })
          .select("id, report_number")
          .single();

        if (reportError) throw new Error(reportError.message);
        const subIBCompensation: SubIBCompensation = {
          dolares_por_lote: formData.dolares_por_lote_sub_ib,
          cpa_allocation: formData.cpa_allocation,
          hybrid_lote: formData.hybrid_lote_sub_ib,
          hybrid_cpa_allocation: formData.hybrid_cpa_allocation,
          propfirm_comision: formData.propfirm_comision_sub_ib,
        };
        const doc = generateSubIBAgreementPDF(formData.masterFormData, subIB, reportData.report_number, formData.master_ib_id, logo, subIBCompensation);
        downloadPdfFile(doc, `IB_Agreement_SubIB_${formData.nombre.replace(/\s+/g, "_")}_${reportData.report_number}.pdf`);
        toast({ title: "📜 Agreement generado", description: `Agreement ${reportData.report_number} descargado.` });
      }
      setDownloadedReports((prev) => [...prev, "agreement"]);
    } catch (err: any) {
      showSupportError("Error generando Agreement", err);
    } finally {
      setGeneratingAgreement(false);
    }
  };

  const handleGenerateTechnical = async () => {
    if (!formData.masterFormData) return;
    setGeneratingTechnical(true);
    try {
      const logo = await getLogoBase64();
      const subFormData = buildSubIBFormData();
      if (!subFormData || !savedSubIBId) return;

      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .insert({
          ib_id: formData.master_ib_id,
          report_type: "technical",
          nombre_bd: formData.masterFormData.nombre_bd,
          nombre_ib: formData.nombre,
          data: {
            ...subFormData,
            _is_sub_ib: true,
            _sub_ib_agreement_for: formData.nombre,
            _parent_ib_name: formData.masterFormData.nombre_ib,
          } as any,
          report_number: "TEMP",
        })
        .select("id, report_number")
        .single();

      if (reportError) throw new Error(reportError.message);
      const doc = generateTechnicalReportPDF(subFormData, reportData.report_number, formData.master_ib_id, logo);
      downloadPdfFile(doc, `IB_Technical_SubIB_${formData.nombre.replace(/\s+/g, "_")}_${reportData.report_number}.pdf`);
      toast({ title: "📄 Technical Report generado", description: `Report ${reportData.report_number} descargado.` });
      setDownloadedReports((prev) => [...prev, "technical"]);
    } catch (err: any) {
      showSupportError("Error generando Technical Report", err);
    } finally {
      setGeneratingTechnical(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...initialSubIBForm });
    setCurrentStep(0);
    setSavedSubIBId(null);
    setDownloadedReports([]);
    sessionStorage.removeItem(SUB_IB_WIZARD_STORAGE_KEY);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {loadingMaster && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando configuración del Master IB...</span>
        </div>
      )}

      <StepIndicator
        steps={steps.map((s) => s.label)}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
      />

      <div className="bg-gradient-card rounded-xl border border-border shadow-card p-6 md:p-8 min-h-[400px]">
        {currentStep === 0 && (
          <StepSelectMasterIB
            selectedId={formData.master_ib_id}
            onSelect={handleSelectMasterIB}
          />
        )}
        {currentStep === 1 && (
          <StepSubIBInfo formData={formData} updateForm={updateForm} />
        )}
        {currentStep === 2 && (
          <StepSubIBCompensation formData={formData} updateForm={updateForm} />
        )}
        {currentStep === 3 && (
          <StepSubIBSummary formData={formData} />
        )}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={handlePrev} disabled={currentStep === 0 || isFinished} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Anterior
        </Button>

        {isLastStep ? (
          <div className="flex gap-3">
            {!isFinished ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {saving ? "Guardando..." : "Crear Sub IB"}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  type="button"
                  onClick={handleGenerateAgreement}
                  disabled={generatingAgreement}
                  className={`gap-2 ${downloadedReports.includes("agreement") ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"}`}
                >
                  {generatingAgreement ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScrollText className="w-4 h-4" />}
                  {downloadedReports.includes("agreement") ? "✓ Agreement" : "Agreement"}
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerateTechnical}
                  disabled={generatingTechnical}
                  className={`gap-2 ${downloadedReports.includes("technical") ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                  variant={downloadedReports.includes("technical") ? "default" : "outline"}
                >
                  {generatingTechnical ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloadedReports.includes("technical") ? "✓ Technical Report" : "Technical Report"}
                </Button>
                <div className="flex gap-2 border-l border-border pl-3 ml-1">
                  <Button type="button" variant="outline" onClick={handleReset} className="gap-2">
                    Nuevo Sub IB
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate("/")} className="gap-2 text-muted-foreground">
                    <Home className="w-4 h-4" /> Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={loadingMaster}
            className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default SubIBWizard;
