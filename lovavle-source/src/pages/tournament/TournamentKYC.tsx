import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DOC_TYPES: { key: string; label: string }[] = [
  { key: "id_front", label: "Documento (frente)" },
  { key: "id_back", label: "Documento (reverso)" },
  { key: "selfie", label: "Selfie con documento" },
  { key: "address_proof", label: "Comprobante de domicilio" },
];

const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res((r.result as string).split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

export default function TournamentKYC() {
  const { user, token, refresh, loading } = useTournamentAuth();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tournament_kyc_documents")
        .select("id,doc_type,status,review_notes,created_at").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setDocs(data || []);
    })();
  }, [user]);

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  const submit = async () => {
    const required = DOC_TYPES.filter(d => d.key !== "address_proof");
    const missing = required.filter(d => !files[d.key]);
    if (missing.length) { toast({ title: "Faltan documentos", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const documents = await Promise.all(
        Object.entries(files).filter(([, f]) => f).map(async ([doc_type, f]) => ({
          doc_type, filename: f!.name, mime: f!.type, content_base64: await fileToBase64(f!),
        }))
      );
      const { data } = await supabase.functions.invoke("tournament-kyc-submit", {
        headers: { Authorization: `Bearer ${token}` }, body: { documents },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✅ Documentos enviados", description: "Te avisaremos cuando se revisen." });
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Verificación KYC (Élite)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            Estado actual:{" "}
            <Badge variant={
              user.kyc_status === "approved" ? "default"
              : user.kyc_status === "rejected" ? "destructive" : "secondary"
            }>{user.kyc_status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Sube documentos legibles (PDF o imagen, máx 8MB cada uno). Aprobamos en 24-72h.
          </p>
          {DOC_TYPES.map(d => (
            <div key={d.key} className="space-y-1">
              <Label>{d.label}{d.key !== "address_proof" && " *"}</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFiles(p => ({ ...p, [d.key]: e.target.files?.[0] || null }))}
              />
            </div>
          ))}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1" />Enviar documentos</>}
          </Button>
        </CardContent>
      </Card>

      {docs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {docs.map(d => (
              <div key={d.id} className="flex justify-between border-b py-1">
                <span>{d.doc_type}</span>
                <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
