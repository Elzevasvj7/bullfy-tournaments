// Panel de referidos del IB.
//
// Muestra, para los usuarios del portal:
//   1) Top referidores — quién ha referido más usuarios (base para campañas
//      futuras de recompensas por cantidad de referidos).
//   2) Tabla de usuarios referidos — de parte de quién llegó cada registro.
//
// El vínculo se guarda en partner_users.referred_by (referido simple, NO MLM),
// poblado en el registro cuando el nuevo usuario llega con un link ?invite=
// (o el link MLM ?ref=). Esta vista es de solo lectura.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Award, Users, Loader2 } from "lucide-react";

interface Props {
  portalId: string;
}

interface PU {
  id: string;
  nombre: string;
  email: string;
  status: string;
  created_at: string;
  referred_by: string | null;
  referred_at: string | null;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  approved: { label: "Aprobado", variant: "default" },
  pending: { label: "Pendiente", variant: "secondary" },
  rejected: { label: "Rechazado", variant: "destructive" },
};

const PartnerReferralsAdmin = ({ portalId }: Props) => {
  const [users, setUsers] = useState<PU[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from as any)("partner_users")
        .select("id, nombre, email, status, created_at, referred_by, referred_at")
        .eq("portal_id", portalId)
        .or("is_host.is.null,is_host.eq.false")
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setUsers((data as PU[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [portalId]);

  const byId = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const referred = useMemo(() => users.filter(u => u.referred_by), [users]);

  const topReferrers = useMemo(() => {
    const counts = new Map<string, number>();
    referred.forEach(u => counts.set(u.referred_by!, (counts.get(u.referred_by!) || 0) + 1));
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        nombre: byId.get(id)?.nombre || "Usuario no encontrado",
        email: byId.get(id)?.email || "",
      }))
      .sort((a, b) => b.count - a.count);
  }, [referred, byId]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando referidos…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{referred.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Usuarios que llegaron por referido</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{topReferrers.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Usuarios que han referido a alguien</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top referidores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Top referidores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aún nadie ha referido usuarios.</p>
          ) : (
            <div className="space-y-1">
              {topReferrers.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className={`w-6 text-center text-sm font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.nombre}</p>
                    {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {r.count} {r.count === 1 ? "referido" : "referidos"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios referidos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios referidos</CardTitle>
        </CardHeader>
        <CardContent>
          {referred.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Todavía no hay usuarios registrados por referido.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Referido por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referred.map(u => {
                    const referrer = byId.get(u.referred_by!);
                    const st = statusLabel[u.status] || { label: u.status, variant: "outline" as const };
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.nombre}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {referrer?.nombre || "Usuario no encontrado"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDate(u.referred_at || u.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerReferralsAdmin;
