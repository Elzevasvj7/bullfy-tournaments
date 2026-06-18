import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Users, AlertTriangle, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

type Source = { module: string; source_id: string; joined_at: string };
type Identity = {
  id: string;
  email_normalized: string;
  phone_normalized: string | null;
  display_name: string | null;
  sources: Source[];
  tags: string[];
  is_duplicate: boolean;
  created_at: string;
};

const MODULE_LABEL: Record<string, { label: string; color: string }> = {
  ib_system: { label: "IB System", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  partner_portal: { label: "Partner Portal", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  tournament: { label: "Tournament", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export default function UnifiedIdentitiesPanel() {
  const [items, setItems] = useState<Identity[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [onlyDup, setOnlyDup] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from("unified_identities" as any).select("*").order("updated_at", { ascending: false }).limit(500);
      if (onlyDup) query = query.eq("is_duplicate", true);
      const { data, error } = await query;
      if (error) { toast.error(error.message); return; }
      setItems((data as any) || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [onlyDup]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      i.email_normalized?.toLowerCase().includes(s) ||
      i.display_name?.toLowerCase().includes(s) ||
      i.phone_normalized?.toLowerCase().includes(s)
    );
  }, [items, q]);

  const stats = useMemo(() => ({
    total: items.length,
    dup: items.filter(i => i.is_duplicate).length,
    tournament: items.filter(i => i.tags?.includes("Tournament")).length,
  }), [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total identidades</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Multi-módulo</div><div className="text-2xl font-bold text-amber-500">{stats.dup}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Tournament</div><div className="text-2xl font-bold text-primary">{stats.tournament}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por email, nombre o teléfono..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={onlyDup} onChange={(e) => setOnlyDup(e.target.checked)} />
          Solo multi-módulo
        </label>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">Sin resultados</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(i => (
            <Card key={i.id} className={i.is_duplicate ? "border-amber-500/40" : ""}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{i.display_name || "(sin nombre)"}</span>
                      {i.is_duplicate && (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 gap-1">
                          <AlertTriangle className="w-3 h-3" /> En {i.sources?.length} módulos
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {i.email_normalized}</span>
                      {i.phone_normalized && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {i.phone_normalized}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(i.sources || []).map((s, idx) => {
                        const m = MODULE_LABEL[s.module] || { label: s.module, color: "bg-muted text-foreground" };
                        return <Badge key={idx} variant="outline" className={`text-[10px] ${m.color}`}>{m.label}</Badge>;
                      })}
                      {(i.tags || []).filter(t => !Object.values(MODULE_LABEL).some(m => m.label === t)).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
