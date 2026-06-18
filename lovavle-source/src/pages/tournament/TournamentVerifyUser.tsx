import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DOCS = [
  { key: "id_front", label: "Documento (frente)" },
  { key: "id_back", label: "Documento (reverso)" },
  { key: "selfie", label: "Selfie con documento" },
];

const toB64 = (f: File): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res((r.result as string).split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(f);
});

export default function TournamentVerifyUser() {
  const { user, token, refresh, loading: authLoading } = useTournamentAuth();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  const submit = async () => {
    const missing = DOCS.filter((d) => !files[d.key]);
    if (missing.length) return toast({ title: "Faltan documentos", variant: "destructive" });
    setBusy(true);
    try {
      const documents = await Promise.all(DOCS.map(async (d) => {
        const f = files[d.key]!;
        return { kind: d.key, filename: f.name, mime: f.type, content_base64: await toB64(f) };
      }));
      const { data } = await supabase.functions.invoke("tournament-user-verify-request", {
        headers: { Authorization: `Bearer ${token}` }, body: { documents },
      });
      if (!data?.ok) throw new Error(data?.error);
      toast({ title: "Solicitud enviada", description: "Te avisaremos al revisar." });
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card className="max-w-xl bg-[#0a1129]/60 border-[#00E5FF]/20">
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck /> Usuario verificado ($25 USDT)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {user.is_verified_user ? (
          <p className="text-[#B6FF3D] font-bold">✓ Ya eres usuario verificado.</p>
        ) : (
          <>
            <p className="text-sm text-gray-400">Sube documentos legibles. Aprobamos en 24-72h. Si rechazamos, devolvemos el USDT.</p>
            {DOCS.map((d) => (
              <div key={d.key}><Label>{d.label}</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFiles((p) => ({ ...p, [d.key]: e.target.files?.[0] || null }))} />
              </div>
            ))}
            <Button onClick={submit} disabled={busy} className="w-full bg-[#B6FF3D] text-black">
              <Upload className="h-4 w-4 mr-1" /> Enviar y pagar $25 USDT
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
