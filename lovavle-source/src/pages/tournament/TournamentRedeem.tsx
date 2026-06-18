import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Copy, Sparkles } from "lucide-react";

export default function TournamentRedeem() {
  const { user, token, refresh, loading: authLoading } = useTournamentAuth();
  const [items, setItems] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCode, setShowCode] = useState<{ code: string; name: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from("tournament_redemption_catalog")
      .select("*").eq("active", true).order("cost_points", { ascending: true });
    setItems(data || []);
    if (user) {
      const { data: m } = await supabase.from("tournament_redemption_codes")
        .select("id, code, used, expires_at, cost_points, created_at, catalog_id, payload")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      setMine(m || []);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const redeem = async (item: any) => {
    if (!user) return;
    if (user.bullfy_points < item.cost_points) { toast.error("Bullfy Points insuficientes"); return; }
    setBusy(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-redeem", {
        body: { catalog_id: item.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error || !data?.ok) { toast.error(data?.error || "Error en canje"); return; }
      setShowCode({ code: data.code, name: item.name });
      await refresh();
      await load();
    } finally { setBusy(null); }
  };

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Canjea tus Bullfy Points</span>
            <Badge variant="outline" className="text-base">{user.bullfy_points} BP</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <Card key={it.id} className="overflow-hidden">
                {it.image_url && <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${it.image_url})` }} />}
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">{it.name}</h3>
                    <Badge variant="outline" className="capitalize text-xs">{it.kind}</Badge>
                  </div>
                  {it.description && <p className="text-xs text-muted-foreground line-clamp-2">{it.description}</p>}
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-primary">{it.cost_points} BP</span>
                    <Button size="sm" disabled={busy === it.id || user.bullfy_points < it.cost_points} onClick={() => redeem(it)}>
                      {busy === it.id ? "..." : "Canjear"}
                    </Button>
                  </div>
                  {it.stock !== null && <p className="text-xs text-muted-foreground">Stock: {it.stock}</p>}
                </CardContent>
              </Card>
            ))}
            {items.length === 0 && <p className="text-muted-foreground col-span-3">Catálogo vacío.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mis códigos</CardTitle></CardHeader>
        <CardContent>
          {mine.length === 0 ? <p className="text-muted-foreground text-sm">Aún no has canjeado ningún código.</p> : (
            <div className="space-y-2">
              {mine.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-border rounded">
                  <div>
                    <div className="font-mono font-semibold">{c.code}</div>
                    <div className="text-xs text-muted-foreground">{c.cost_points} BP · expira {new Date(c.expires_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.used ? <Badge variant="outline">Usado</Badge> : <Badge>Activo</Badge>}
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!showCode} onOpenChange={() => setShowCode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />¡Canje exitoso!</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{showCode?.name}</p>
            <div className="bg-muted p-4 rounded text-center font-mono text-2xl tracking-widest">{showCode?.code}</div>
            <p className="text-xs text-muted-foreground">Guarda este código. Lo usarás para reclamar tu beneficio.</p>
            <Button className="w-full" onClick={() => { navigator.clipboard.writeText(showCode!.code); toast.success("Copiado"); }}>
              <Copy className="h-4 w-4 mr-2" />Copiar código
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
