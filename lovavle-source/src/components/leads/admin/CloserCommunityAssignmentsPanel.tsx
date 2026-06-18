import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Users, UserCheck } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";

interface Assignment {
  id: string;
  closer_user_id: string;
  portal_id: string;
  created_at: string;
}

const CloserCommunityAssignmentsPanel = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedCloser, setSelectedCloser] = useState<string>("");
  const [selectedPortal, setSelectedPortal] = useState<string>("");

  // Closers (rol ventas)
  const { data: closers = [] } = useQuery({
    queryKey: ["all-closers"],
    queryFn: async () => {
      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "ventas");
      if (error) throw error;
      const ids = (roleRows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: e2 } = await supabase
        .from("profiles")
        .select("id, nombre, correo")
        .in("id", ids);
      if (e2) throw e2;
      return profiles || [];
    },
    staleTime: 60_000,
  });

  const { data: portals = [] } = useQuery({
    queryKey: ["all-portals-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_portals")
        .select("id, display_name, nombre_portal")
        .order("display_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["all-community-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closer_community_assignments")
        .select("id, closer_user_id, portal_id, created_at");
      if (error) throw error;
      return (data || []) as Assignment[];
    },
    staleTime: 30_000,
  });

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedCloser || !selectedPortal) throw new Error("Selecciona closer y comunidad");
      const { error } = await supabase
        .from("closer_community_assignments")
        .insert({ closer_user_id: selectedCloser, portal_id: selectedPortal, assigned_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-community-assignments"] });
      toast.success("Comunidad asignada");
      setSelectedPortal("");
    },
    onError: (e: any) => {
      if (e.code === "23505") toast.error("Ese closer ya tiene esa comunidad asignada");
      else toast.error(e.message || "Error al asignar");
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("closer_community_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-community-assignments"] });
      toast.success("Asignación removida");
    },
  });

  const portalById = useMemo(() => {
    const m = new Map<string, any>();
    portals.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [portals]);

  const closerById = useMemo(() => {
    const m = new Map<string, any>();
    closers.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [closers]);

  // Agrupar por closer
  const byCloser = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const arr = m.get(a.closer_user_id) || [];
      arr.push(a);
      m.set(a.closer_user_id, arr);
    }
    return m;
  }, [assignments]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Asignación de comunidades a closers</h3>
          <p className="text-xs text-muted-foreground">
            Cada closer solo puede ver y tomar leads de las comunidades que le asignes aquí.
          </p>
        </div>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nueva asignación</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-muted-foreground mb-1">Closer</p>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger><SelectValue placeholder="Selecciona closer..." /></SelectTrigger>
              <SelectContent>
                {closers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} — {c.correo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-muted-foreground mb-1">Comunidad</p>
            <Select value={selectedPortal} onValueChange={setSelectedPortal}>
              <SelectTrigger><SelectValue placeholder="Selecciona comunidad..." /></SelectTrigger>
              <SelectContent>
                {portals.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name || p.nombre_portal}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => addAssignment.mutate()}
            disabled={!selectedCloser || !selectedPortal || addAssignment.isPending}
            className="gap-1"
          >
            <Plus className="w-4 h-4" /> Asignar
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {closers.map((c: any) => {
          const list = byCloser.get(c.id) || [];
          return (
            <Card key={c.id} className="bg-card/60 border-border">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{c.nombre}</span>
                    <span className="text-xs text-muted-foreground">{c.correo}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{list.length} comunidades</Badge>
                </div>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin comunidades asignadas — no podrá ver leads.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((a) => {
                      const p = portalById.get(a.portal_id);
                      return (
                        <Badge key={a.id} variant="outline" className="gap-1 pr-1">
                          {p?.display_name || p?.nombre_portal || "—"}
                          <button
                            onClick={() => removeAssignment.mutate(a.id)}
                            className="hover:text-destructive ml-1"
                            title="Quitar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CloserCommunityAssignmentsPanel;
