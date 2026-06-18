import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { FileText, CheckSquare, Loader2, Download, ExternalLink } from "lucide-react";
import { generateTechnicalReportPDF } from "@/services/generateTechnicalReport";
import { generateMTFASTReportPDF } from "@/services/generateMTFASTReport";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

interface Report {
  id: string;
  report_type: string;
  report_number: string;
  nombre_ib: string;
  created_at: string;
  data: any;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ibId: string;
  opsQueueId: string;
  ibName: string;
  userId?: string;
}

/**
 * Build checklist items from the actual Technical Report formData.
 * Each item is a high-level configuration task — the operator reviews the report for details.
 */
function buildChecklistFromReport(formData: any): string[] {
  const items: string[] = [];
  if (!formData) return items;

  // General verification
  items.push("Verificar datos de IB en sistema");

  // Modelo
  const modelo = formData.modelo_negocio === "Ambos" ? "Brokeraje + PropFirm" : formData.modelo_negocio;
  items.push(`Configurar modelo: ${modelo}`);

  const showBrokeraje = formData.modelo_negocio === "Brokeraje" || formData.modelo_negocio === "Ambos";
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje) {
    items.push(`Tipo acuerdo brokeraje: ${formData.tipo_acuerdo_brokeraje}`);
  }

  // Spreads — single item
  const isHybrid = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido";
  const isRebates = showBrokeraje && formData.tipo_acuerdo_brokeraje === "Rebates";
  if ((isRebates || isHybrid) && formData.spread_config?.length > 0) {
    items.push("Configuración de spread de activos");
  }

  // Rebate allocations for Sub IBs — single item
  if (isRebates && formData.sub_ib_rebate_allocations?.length > 0) {
    items.push("Configurar rebates de Sub IBs");
  }

  // CPA config — single item
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "CPA" && formData.cpa_config?.length > 0) {
    items.push("Configurar rangos CPA");
  }

  // Hybrid config — single item
  if (showBrokeraje && formData.tipo_acuerdo_brokeraje === "Híbrido" && formData.hybrid_config?.length > 0) {
    items.push("Configurar rangos Híbrido (CPA + Lotes)");
  }

  // CPA Distribution — single item
  if (formData.repartir_cpa && formData.cpa_distribution?.length > 0) {
    items.push("Configurar distribución CPA");
  }

  // PropFirm — single item
  const showPropFirm = formData.modelo_negocio === "PropFirm" || formData.modelo_negocio === "Ambos";
  if (showPropFirm && formData.propfirm_config?.length > 0) {
    items.push("Configurar comisiones PropFirm");
  }

  // Accounts — single items per type
  if (formData.cuentas_marketing_tipo && formData.cuentas_marketing_tipo !== "No tiene") {
    items.push("Crear cuentas de Marketing");
  }
  if (formData.tiene_fondeo_regalo) {
    items.push("Crear cuentas de Fondeo Regalo");
  }
  if (formData.tiene_fondeo_especial) {
    items.push("Crear cuenta de Fondeo Especial");
  }
  if (formData.tiene_codigo_descuento && formData.codigo_descuento) {
    items.push("Configurar código de descuento");
  }

  // Sub IBs — single item
  if (formData.tiene_sub_ibs && formData.sub_ibs?.length > 0) {
    items.push(`Registrar Sub IBs (${formData.sub_ibs.length})`);
  }

  // Negociaciones especiales
  if (formData.negociaciones_especiales) {
    items.push("Revisar negociaciones especiales");
  }

  return items;
}

const OpsViewDialog = ({ open, onOpenChange, ibId, opsQueueId, ibName, userId }: Props) => {
  const [persistedTab, setPersistedTab] = useSessionStorageState<"reports" | "checklist">(
    `bullfy:operaciones:ops-view:${opsQueueId}:tab`,
    "reports",
  );
  const [reports, setReports] = useState<Report[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reports" | "checklist">(persistedTab);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    setTab(persistedTab);
  }, [persistedTab]);

  useEffect(() => {
    setPersistedTab(tab);
  }, [setPersistedTab, tab]);

  const handleDownloadReport = async (report: Report) => {
    setGeneratingPdf(report.id);
    try {
      const logo = await getLogoBase64();
      const doc = generateTechnicalReportPDF(report.data, report.report_number, ibId, logo, !!report.data?._is_update);
      doc.save(`${report.report_number}.pdf`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleDownloadMTFAST = async (report: Report) => {
    setGeneratingPdf(report.id + "_mtfast");
    try {
      const logo = await getLogoBase64();
      const doc = generateMTFASTReportPDF(report.data, "MTFAST-" + report.report_number, ibId, logo);
      doc.save(`MTFAST-${report.report_number}.pdf`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handlePreviewReport = async (report: Report) => {
    setGeneratingPdf(report.id);
    try {
      const logo = await getLogoBase64();
      const doc = generateTechnicalReportPDF(report.data, report.report_number, ibId, logo, !!report.data?._is_update);
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl as unknown as string, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("reports")
        .select("id, report_type, report_number, nombre_ib, created_at, data")
        .eq("ib_id", ibId)
        .eq("report_type", "technical")
        .order("created_at", { ascending: false }),
      supabase
        .from("ops_checklist")
        .select("id, label, checked")
        .eq("ops_queue_id", opsQueueId)
        .order("created_at", { ascending: true }),
    ]).then(async ([reportsRes, checklistRes]) => {
      const fetchedReports = (reportsRes.data as Report[]) ?? [];
      setReports(fetchedReports);

      let items = (checklistRes.data as ChecklistItem[]) ?? [];

      // Auto-create checklist from the latest technical report if empty
      if (items.length === 0 && fetchedReports.length > 0) {
        const latestReport = fetchedReports[0]; // most recent
        const labels = buildChecklistFromReport(latestReport.data);
        if (labels.length > 0) {
          const rows = labels.map((label) => ({
            ops_queue_id: opsQueueId,
            ib_id: ibId,
            label,
            checked: false,
          }));
          const { data: inserted } = await supabase.from("ops_checklist").insert(rows).select("id, label, checked");
          items = (inserted as ChecklistItem[]) ?? [];
        }
      }
      setChecklist(items);
      setLoading(false);
    });
  }, [open, ibId, opsQueueId]);

  const toggleCheck = async (item: ChecklistItem) => {
    const newChecked = !item.checked;
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, checked: newChecked } : c)));
    const updates: Record<string, any> = { checked: newChecked };
    if (newChecked && userId) {
      updates.checked_by = userId;
      updates.checked_at = new Date().toISOString();
    } else {
      updates.checked_by = null;
      updates.checked_at = null;
    }
    const { error } = await supabase.from("ops_checklist").update(updates as any).eq("id", item.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const completedCount = checklist.filter((c) => c.checked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle — {ibName}</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            size="sm"
            variant={tab === "reports" ? "default" : "ghost"}
            onClick={() => setTab("reports")}
            className={tab === "reports" ? "bg-gradient-gold text-primary-foreground" : ""}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Technical Reports
          </Button>
          <Button
            size="sm"
            variant={tab === "checklist" ? "default" : "ghost"}
            onClick={() => setTab("checklist")}
            className={tab === "checklist" ? "bg-gradient-gold text-primary-foreground" : ""}
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Checklist ({completedCount}/{checklist.length})
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : tab === "reports" ? (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay Technical Reports generados para este IB.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.report_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Técnico — {new Date(r.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {r.data?._is_update && (
                      <Badge variant="outline" className="text-[10px] mt-1">Actualización</Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePreviewReport(r)}
                      disabled={generatingPdf === r.id}
                      className="text-primary hover:text-primary gap-1"
                    >
                      {generatingPdf === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadReport(r)}
                      disabled={generatingPdf === r.id}
                      className="text-accent hover:text-accent gap-1"
                    >
                      {generatingPdf === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Descargar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadMTFAST(r)}
                      disabled={generatingPdf === r.id + "_mtfast"}
                      className="text-primary hover:text-primary/80 gap-1"
                    >
                      {generatingPdf === r.id + "_mtfast" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} MTFAST
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay checklist disponible. Se generará automáticamente cuando exista un Technical Report.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Checklist generado desde el Technical Report. Marca cada ítem una vez configurado en el sistema.
                </p>
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      item.checked ? "border-accent/40 bg-accent/5" : "border-border bg-secondary/10 hover:bg-secondary/20"
                    }`}
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleCheck(item)}
                      className="mt-0.5"
                    />
                    <span className={`text-sm ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: checklist.length > 0 ? `${(completedCount / checklist.length) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {completedCount}/{checklist.length}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OpsViewDialog;
