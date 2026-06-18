import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toastUtils";
import { Search, Sparkles } from "lucide-react";

interface FamilyProfile {
  id: string;
  nombre: string;
  correo: string;
  status: string;
  created_at: string;
}

const BullfyFamily = () => {
  const [members, setMembers] = useState<FamilyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
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
        .select("id, nombre, correo, status, created_at")
        .in("id", userIds);

      setMembers((profiles as FamilyProfile[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar miembros de Bullfy Family");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => (m.nombre || "").toLowerCase().includes(q) || (m.correo || "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      approved: { label: "Aprobado", variant: "default" },
      pending: { label: "Pendiente", variant: "secondary" },
      rejected: { label: "Rechazado", variant: "destructive" },
      disabled: { label: "Deshabilitado", variant: "outline" },
    };
    const cfg = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total miembros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{members.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {members.filter((m) => m.status === "approved").length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {members.filter((m) => m.status === "pending").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Members table */}
      <Card className="border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Miembro</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Sparkles className="w-8 h-8 text-muted-foreground/40" />
                    <span>
                      No hay miembros con el rol <strong>Bullfy Family</strong> asignado todavía.
                    </span>
                    <span className="text-xs">
                      Asigna el rol desde la pestaña Usuarios → Roles.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.correo}</TableCell>
                  <TableCell className="text-center">{statusBadge(m.status)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default BullfyFamily;
