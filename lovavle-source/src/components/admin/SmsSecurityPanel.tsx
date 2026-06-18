import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Trash2, Plus, Save, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Block = { id: string; phone: string; reason: string | null; blocked_at: string };
type Config = {
  email_purpose_per_10min: number;
  phone_per_10min: number;
  phone_per_24h: number;
  updated_at: string;
};

export default function SmsSecurityPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [blocklist, setBlocklist] = useState<Block[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newReason, setNewReason] = useState("");

  const call = async (action: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("sms-security-admin", { body: { action, payload } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Error");
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await call("list");
      setBlocklist(data.blocklist || []);
      setConfig(data.config || null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addBlock = async () => {
    if (!newPhone.trim().startsWith("+")) {
      toast({ title: "Formato inválido", description: "Usa formato E.164 (+593...)", variant: "destructive" });
      return;
    }
    setBusy("add");
    try {
      await call("add_block", { phone: newPhone.trim(), reason: newReason.trim() || "manual" });
      toast({ title: "✅ Número bloqueado" });
      setNewPhone(""); setNewReason("");
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const removeBlock = async (phone: string) => {
    if (!confirm(`¿Desbloquear ${phone}?`)) return;
    setBusy(phone);
    try {
      await call("remove_block", { phone });
      toast({ title: "✅ Desbloqueado" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const saveConfig = async () => {
    if (!config) return;
    setBusy("config");
    try {
      await call("update_config", config);
      toast({ title: "✅ Configuración actualizada" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Rate Limits SMS</CardTitle>
          <CardDescription>Control de envío de SMS para prevenir abuso. Aplica a todos los OTP excepto whitelisted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Por email + propósito (10 min)</Label>
              <Input type="number" min={1} max={50}
                value={config?.email_purpose_per_10min ?? 3}
                onChange={(e) => setConfig(c => c ? { ...c, email_purpose_per_10min: Number(e.target.value) } : c)} />
              <p className="text-xs text-muted-foreground">Límite recomendado: 3</p>
            </div>
            <div className="space-y-1">
              <Label>Por teléfono (10 min)</Label>
              <Input type="number" min={1} max={50}
                value={config?.phone_per_10min ?? 2}
                onChange={(e) => setConfig(c => c ? { ...c, phone_per_10min: Number(e.target.value) } : c)} />
              <p className="text-xs text-muted-foreground">Límite recomendado: 2</p>
            </div>
            <div className="space-y-1">
              <Label>Por teléfono (24 hr)</Label>
              <Input type="number" min={1} max={100}
                value={config?.phone_per_24h ?? 5}
                onChange={(e) => setConfig(c => c ? { ...c, phone_per_24h: Number(e.target.value) } : c)} />
              <p className="text-xs text-muted-foreground">Anti-pumping: 5</p>
            </div>
          </div>
          <Button onClick={saveConfig} disabled={busy === "config"}>
            {busy === "config" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar configuración
          </Button>
          {config?.updated_at && <p className="text-xs text-muted-foreground">Última actualización: {new Date(config.updated_at).toLocaleString()}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /> Blocklist de Teléfonos</CardTitle>
          <CardDescription>Números bloqueados de recibir SMS. Total: {blocklist.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2 items-end p-3 rounded border bg-muted/30">
            <div className="flex-1 space-y-1">
              <Label>Teléfono (E.164)</Label>
              <Input placeholder="+593987654321" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Motivo</Label>
              <Input placeholder="abuse / pumping / fraud" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
            </div>
            <Button onClick={addBlock} disabled={busy === "add"}>
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Bloquear
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teléfono</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Bloqueado</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocklist.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-sm">{b.phone}</TableCell>
                  <TableCell><Badge variant="outline">{b.reason || "—"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(b.blocked_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => removeBlock(b.phone)} disabled={busy === b.phone}>
                      {busy === b.phone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {blocklist.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay números bloqueados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
