import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Loader2 } from "lucide-react";

export interface FamilyMember {
  id: string;
  nombre: string;
  correo: string;
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const BullfyFamilyInviteSelector = ({ selectedIds, onChange }: Props) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "bullfy_family" as any);
      const userIds = roleRows?.map((r) => r.user_id) ?? [];
      if (userIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nombre, correo")
        .in("id", userIds)
        .order("nombre");
      setMembers((profiles as FamilyMember[]) || []);
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const filtered = members.filter(
    (m) =>
      m.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      m.correo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Invitar miembros Bullfy Family
        </Label>
        <Badge variant="outline" className="text-xs">
          {selectedIds.length} seleccionados
        </Badge>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border/50">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando miembros...
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {members.length === 0
              ? "No hay miembros con rol Bullfy Family aún."
              : "Sin resultados para tu búsqueda."}
          </p>
        ) : (
          filtered.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <Checkbox checked={selectedIds.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.nombre || "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground truncate">{m.correo}</p>
              </div>
            </label>
          ))
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Los miembros seleccionados recibirán un correo de invitación y verán esta sala en su Bullfy
        Live.
      </p>
    </div>
  );
};

export default BullfyFamilyInviteSelector;
