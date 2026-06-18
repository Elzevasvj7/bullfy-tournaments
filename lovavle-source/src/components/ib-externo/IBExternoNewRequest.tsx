import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { UserPlus, DollarSign, AlertTriangle, CheckCircle, ArrowLeft, Send, BarChart3, Gift, Sparkles, Crown } from "lucide-react";
import RequestAttachmentsUploader, { RequestAttachment } from "./RequestAttachmentsUploader";

const ID_TYPES = ["Cédula", "Pasaporte", "DNI", "Otro"];

const REQUEST_TYPE_CONFIG: Record<string, { label: string; icon: any; description: string }> = {
  sub_ib: { label: "Nuevo Sub IB", icon: UserPlus, description: "Incorporar un nuevo Sub IB a tu línea comercial" },
  cuentas_marketing: { label: "Cuentas de Marketing", icon: BarChart3, description: "Solicitar cuentas de marketing para tu operación" },
  cuentas_regalo: { label: "Cuentas de Regalo", icon: Gift, description: "Solicitar cuentas de regalo para tus clientes" },
  especial: { label: "Solicitud Especial", icon: Sparkles, description: "Solicitud personalizada" },
};

interface IBData {
  id: string;
  nombre_ib: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
}

interface SpreadConfig {
  symbol: string;
  dolares_ib_original: number;
  nuevo_dolar_ib: number | null;
}

interface SubIBInfo {
  id: string;
  nombre: string;
  correo: string;
  es_master_ib: boolean;
  master_ib_numero: number | null;
  dolares_por_lote: number | null;
  parent_sub_ib_id: string | null;
  alias: string | null;
}


const IBExternoNewRequest = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestType = searchParams.get("tipo") || "sub_ib";
  const typeConfig = REQUEST_TYPE_CONFIG[requestType] || REQUEST_TYPE_CONFIG.sub_ib;

  const [ibData, setIbData] = useState<IBData | null>(null);
  const [spreadConfig, setSpreadConfig] = useState<SpreadConfig[]>([]);
  const [allSubIBs, setAllSubIBs] = useState<SubIBInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Sub IB form data
  const [kycCompleted, setKycCompleted] = useState(false);
  const [existsInSystem, setExistsInSystem] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [idDocumento, setIdDocumento] = useState("");
  const [dolaresPorLote, setDolaresPorLote] = useState(0);

  // Generic request form data
  const [description, setDescription] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [notas, setNotas] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);

  useEffect(() => {
    const loadIBData = async () => {
      if (!profile?.ib_id) {
        toast.error("No tienes un IB asignado");
        setLoading(false);
        return;
      }

      const [ibRes, spreadRes, subIbsRes] = await Promise.all([
        supabase.from("ibs").select("id, nombre_ib, modelo_negocio, tipo_acuerdo_brokeraje").eq("id", profile.ib_id).single(),
        supabase.from("ib_spread_config").select("symbol, dolares_ib_original, nuevo_dolar_ib").eq("ib_id", profile.ib_id),
        supabase.from("sub_ibs").select("id, nombre, correo, es_master_ib, master_ib_numero, dolares_por_lote, parent_sub_ib_id, alias").eq("ib_id", profile.ib_id),
      ]);

      if (ibRes.data) setIbData(ibRes.data);
      if (spreadRes.data) setSpreadConfig(spreadRes.data);
      if (subIbsRes.data) {
        setAllSubIBs(
          (subIbsRes.data as any[]).sort((a, b) => (a.master_ib_numero ?? 999) - (b.master_ib_numero ?? 999))
        );
      }
      setLoading(false);
    };

    loadIBData();
  }, [profile?.ib_id]);

  // Determine the current user's sub_ib record
  const currentUserEmail = profile?.correo?.toLowerCase() || "";
  const profileSubIBId = profile?.sub_ib_id || null;
  const profileRecord = profileSubIBId ? allSubIBs.find(s => s.id === profileSubIBId) : null;

  // If no sub_ib_id in profile, try matching by email (backward compatibility)
  const fallbackRecord = !profileRecord
    ? allSubIBs.find(s => s.correo.toLowerCase() === currentUserEmail)
    : null;
  const effectiveRecord = profileRecord || fallbackRecord;
  // Derive the effective sub_ib_id (from profile or fallback match)
  const mySubIBId = effectiveRecord?.id || null;

  const isMasterIBExtra = !!effectiveRecord?.es_master_ib;
  const myMasterNumber = effectiveRecord?.master_ib_numero ?? 1;
  const myAllocatedLote = effectiveRecord?.dolares_por_lote ?? 0;

  // Show the immediate upline name — parent Sub IB if exists, otherwise IB principal
  const uplineName = (() => {
    if (effectiveRecord?.parent_sub_ib_id) {
      const parentRecord = allSubIBs.find(s => s.id === effectiveRecord.parent_sub_ib_id);
      if (parentRecord) return parentRecord.alias || parentRecord.nombre;
    }
    return ibData?.nombre_ib || "IB Principal";
  })();

  // Show the logged-in user's own name
  const myDisplayName = effectiveRecord?.alias || effectiveRecord?.nombre || (profile as any)?.alias || profile?.nombre || "Tu usuario";

  // Total $/lote for the entire line (from spread config)
  const totalDolarLote = spreadConfig.length > 0
    ? (spreadConfig[0].nuevo_dolar_ib ?? spreadConfig[0].dolares_ib_original)
    : 7;

  // For regular Sub IBs (non-master), their available is simply their own $/lote
  const isRegularSubIB = !!effectiveRecord && !effectiveRecord.es_master_ib;

  // The user's ORIGINAL $/lote from DB — each new Sub IB request starts from this value
  // No subtracting existing children — each request is independent
  const requesterOriginalLote = isRegularSubIB
    ? myAllocatedLote
    : isMasterIBExtra
    ? myAllocatedLote
    : (() => {
        const allMastersTotal = allSubIBs.filter(s => s.es_master_ib).reduce((sum, s) => sum + (s.dolares_por_lote ?? 0), 0);
        return totalDolarLote - allMastersTotal;
      })();

  // Available = full original amount (each request is independent)
  const availableForRequest = requesterOriginalLote;
  const remaining = availableForRequest - dolaresPorLote;

  const canSubmitSubIB = nombre.trim() && correo.trim() && tipoId && idDocumento.trim() && dolaresPorLote > 0 && remaining >= 0;
  const canSubmitGeneric = description.trim();

  const handleSubmitSubIB = async () => {
    if (!user || !ibData) return;
    setSubmitting(true);

    // Build full upline chain for ops visibility
    const masterIBs = allSubIBs.filter(s => s.es_master_ib);
    const allMastersTotal = masterIBs.reduce((sum, s) => sum + (s.dolares_por_lote ?? 0), 0);
    const masterIB1DolarLote = totalDolarLote - allMastersTotal;

    const compensationData = {
      total_linea: totalDolarLote,
      master_ib1: {
        nombre: ibData?.nombre_ib || "Principal",
        dolares_por_lote: masterIB1DolarLote,
      },
      otros_master_ibs: masterIBs
        .filter(s => s.id !== mySubIBId)
        .map(s => ({
          numero: s.master_ib_numero,
          nombre: s.alias || s.nombre,
          correo: s.correo,
          dolares_por_lote: s.dolares_por_lote ?? 0,
        })),
      sub_ibs_existentes: allSubIBs
        .filter(s => !s.es_master_ib && s.id !== mySubIBId)
        .map(s => ({
          nombre: s.alias || s.nombre,
          correo: s.correo,
          dolares_por_lote: s.dolares_por_lote ?? 0,
        })),
      solicitante: {
        es_master_extra: isMasterIBExtra,
        es_sub_ib: isRegularSubIB,
        master_numero: myMasterNumber,
        nombre: effectiveRecord?.alias || effectiveRecord?.nombre || profile?.nombre || "",
        correo: currentUserEmail,
        sub_ib_id: mySubIBId,
        dolares_antes: requesterOriginalLote,
        dolares_despues: remaining,
      },
      sub_ib_dolar_lote: dolaresPorLote,
      parent_sub_ib_id: mySubIBId,
      spread_config: spreadConfig.map((s) => ({
        symbol: s.symbol,
        original: s.dolares_ib_original,
      })),
    };

    const { error } = await supabase.from("ib_external_requests").insert({
      ib_id: ibData.id,
      requested_by: user.id,
      request_type: "sub_ib",
      sub_ib_nombre: nombre,
      sub_ib_correo: correo,
      sub_ib_tipo_id: tipoId,
      sub_ib_id_documento: idDocumento,
      sub_ib_kyc_completed: kycCompleted,
      sub_ib_exists_in_system: existsInSystem,
      dolares_por_lote_sub_ib: dolaresPorLote,
      compensation_data: compensationData,
      attachments: attachments as any,
    });

    if (error) {
      toast.error("Error al crear solicitud: " + error.message);
    } else {
      toast.success("Solicitud enviada exitosamente. Tu BD será notificado.");
      navigate("/ib-portal/solicitudes");
    }
    setSubmitting(false);
  };

  const handleSubmitGeneric = async () => {
    if (!user || !ibData) return;
    setSubmitting(true);

    const { error } = await supabase.from("ib_external_requests").insert({
      ib_id: ibData.id,
      requested_by: user.id,
      request_type: requestType,
      sub_ib_nombre: requestType === "cuentas_marketing" ? "Cuentas Marketing" : requestType === "cuentas_regalo" ? "Cuentas Regalo" : "Solicitud Especial",
      sub_ib_correo: profile?.correo || "",
      notes: `${description}${cantidad ? `\nCantidad: ${cantidad}` : ""}${notas ? `\nNotas: ${notas}` : ""}`,
      compensation_data: { tipo: requestType, descripcion: description, cantidad, notas },
      attachments: attachments as any,
    });

    if (error) {
      toast.error("Error al crear solicitud: " + error.message);
    } else {
      toast.success("Solicitud enviada exitosamente.");
      navigate("/ib-portal/solicitudes");
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="text-muted-foreground">Cargando...</div></div>;
  }

  if (!ibData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se encontró tu línea de IB asignada.</p>
        <p className="text-xs text-muted-foreground mt-1">Contacta a tu BD para resolver este problema.</p>
      </div>
    );
  }

  const TypeIcon = typeConfig.icon;

  // Generic request form (marketing, regalo, especial)
  if (requestType !== "sub_ib") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ib-portal")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{typeConfig.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">{typeConfig.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-sm">
          <span className="text-muted-foreground">Tu línea IB:</span>
          <span className="font-semibold text-foreground">{uplineName}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TypeIcon className="w-5 h-5 text-primary" />
              Detalles de la solicitud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Descripción de la solicitud *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  requestType === "cuentas_marketing"
                    ? "Describe qué tipo de cuentas de marketing necesitas, balance, tipo de cuenta..."
                    : requestType === "cuentas_regalo"
                    ? "Describe las cuentas de regalo que necesitas, cantidad, balance..."
                    : "Describe detalladamente tu solicitud..."
                }
                rows={4}
              />
            </div>
            {(requestType === "cuentas_marketing" || requestType === "cuentas_regalo") && (
              <div className="space-y-2">
                <Label>Cantidad de cuentas</Label>
                <Input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Número de cuentas"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Información adicional que consideres relevante..."
                rows={2}
              />
            </div>
            {user && (
              <RequestAttachmentsUploader
                userId={user.id}
                value={attachments}
                onChange={setAttachments}
                disabled={submitting}
              />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/ib-portal")}>Cancelar</Button>
              <Button onClick={handleSubmitGeneric} disabled={!canSubmitGeneric || submitting} className="flex-1 gap-2">
                <Send className="w-4 h-4" />
                {submitting ? "Enviando..." : "Enviar Solicitud"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sub IB wizard
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ib-portal")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nueva Solicitud de Sub IB</h2>
          <p className="text-sm text-muted-foreground mt-1">Incorpora un nuevo Sub IB a tu línea comercial</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-sm">
          <span className="text-muted-foreground">Tu línea IB:</span>
          <span className="font-semibold text-foreground">{uplineName}</span>
        <Badge variant="outline" className="text-[10px]">{ibData.modelo_negocio}</Badge>
        {ibData.tipo_acuerdo_brokeraje && <Badge variant="secondary" className="text-[10px]">{ibData.tipo_acuerdo_brokeraje}</Badge>}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Verificación Previa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>¿El Sub IB ya existe en el sistema Bullfy?</Label>
                <p className="text-xs text-muted-foreground">Indica si esta persona ya tiene cuenta en la plataforma</p>
              </div>
              <Switch checked={existsInSystem} onCheckedChange={setExistsInSystem} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>¿El Sub IB ha completado el KYC?</Label>
                <p className="text-xs text-muted-foreground">Verificación de identidad completada</p>
              </div>
              <Switch checked={kycCompleted} onCheckedChange={setKycCompleted} />
            </div>
            <Button onClick={() => setStep(2)} className="w-full" disabled={!existsInSystem || !kycCompleted}>Continuar</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Datos del Sub IB
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del Sub IB" />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={tipoId} onValueChange={setTipoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de documento</Label>
                <Input value={idDocumento} onChange={(e) => setIdDocumento(e.target.value)} placeholder="Número de identificación" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button onClick={() => setStep(3)} disabled={!nombre.trim() || !correo.trim() || !tipoId || !idDocumento.trim()} className="flex-1">
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Distribución de Compensación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current allocation — user's original $/lote (each request is independent) */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Tu asignación
              </p>
              <p className="text-sm text-foreground mt-1">
                <span className="font-semibold text-primary">{myDisplayName}</span> — <span className="font-bold text-primary">${requesterOriginalLote}/lote</span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">$/Lote para nuevo Sub IB</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max={availableForRequest}
                  value={dolaresPorLote || ""}
                  onChange={(e) => setDolaresPorLote(parseFloat(e.target.value) || 0)}
                  className="w-32"
                  placeholder="0"
                />
              </div>
              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">Disponible: <strong className="text-foreground">${availableForRequest}</strong></div>
                <div className={`font-semibold ${remaining < 0 ? "text-destructive" : "text-primary"}`}>
                  Restante: ${remaining}
                </div>
              </div>
            </div>

            {remaining < 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" />
                La asignación excede tu total disponible
              </div>
            )}

            {dolaresPorLote > 0 && remaining >= 0 && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Vista previa</h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Requester */}
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-center">
                    <p className="text-xs text-primary font-semibold">Tú</p>
                    <p className="text-[10px] text-muted-foreground truncate">{myDisplayName}</p>
                    <p className="text-lg font-bold text-primary">${availableForRequest - dolaresPorLote}/lote</p>
                    <p className="text-[10px] text-muted-foreground">Disponible antes: ${availableForRequest}</p>
                  </div>
                  {/* New Sub IB */}
                  <div className="rounded-lg bg-secondary border border-primary/30 p-3 text-center">
                    <p className="text-xs text-primary font-semibold">Nuevo Sub IB</p>
                    <p className="text-[10px] text-muted-foreground truncate">{nombre || "—"}</p>
                    <p className="text-lg font-bold text-primary">${dolaresPorLote}/lote</p>
                  </div>
                </div>
              </div>
            )}

            {user && (
              <RequestAttachmentsUploader
                userId={user.id}
                value={attachments}
                onChange={setAttachments}
                disabled={submitting}
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
              <Button
                onClick={handleSubmitSubIB}
                disabled={!canSubmitSubIB || submitting}
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Enviando..." : "Enviar Solicitud"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IBExternoNewRequest;
