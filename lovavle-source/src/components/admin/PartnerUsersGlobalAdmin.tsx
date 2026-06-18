import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toastUtils";
import { Loader2, Search, Users2, Crown, KeyRound, FlaskConical } from "lucide-react";
import ChangePartnerPasswordDialog from "@/components/partner/ChangePartnerPasswordDialog";
import GrantDemoFundsDialog from "@/components/admin/GrantDemoFundsDialog";

interface PartnerUserRow {
  id: string;
  nombre: string;
  email: string;
  portal_id: string;
  status: string;
  can_be_business_partner: boolean;
  mlm_enabled: boolean;
  portal_name?: string;
}

interface PortalOption {
  id: string;
  display_name: string;
}

const PartnerUsersGlobalAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PartnerUserRow[]>([]);
  const [portals, setPortals] = useState<PortalOption[]>([]);
  const [search, setSearch] = useState("");
  const [filterPortal, setFilterPortal] = useState<string>("all");
  const [filterEligible, setFilterEligible] = useState<string>("all");
  const [pwTarget, setPwTarget] = useState<PartnerUserRow | null>(null);
  const [demoTarget, setDemoTarget] = useState<PartnerUserRow | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [usersRes, portalsRes] = await Promise.all([
      supabase
        .from("partner_users")
        .select("id, nombre, email, portal_id, status, can_be_business_partner, mlm_enabled")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("partner_portals").select("id, display_name").order("display_name"),
    ]);

    const portalMap: Record<string, string> = {};
    (portalsRes.data ?? []).forEach((p: any) => { portalMap[p.id] = p.display_name; });
    setPortals((portalsRes.data ?? []) as PortalOption[]);
    setUsers(((usersRes.data ?? []) as any[]).map(u => ({ ...u, portal_name: portalMap[u.portal_id] || "—" })));
    setLoading(false);
  };

  const toggleEligible = async (id: string, value: boolean) => {
    const { error } = await supabase
      .from("partner_users")
      .update({ can_be_business_partner: value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Habilitado como socio elegible" : "Elegibilidad removida");
    setUsers(users.map(u => u.id === id ? { ...u, can_be_business_partner: value } : u));
  };

  const toggleMlm = async (id: string, value: boolean) => {
    const { error } = await (supabase.from as any)("partner_users")
      .update({ mlm_enabled: value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "MLM (red) activado para el usuario" : "MLM (red) desactivado");
    setUsers(users.map(u => u.id === id ? { ...u, mlm_enabled: value } : u));
  };

  const filtered = users.filter(u => {
    if (filterPortal !== "all" && u.portal_id !== filterPortal) return false;
    if (filterEligible === "yes" && !u.can_be_business_partner) return false;
    if (filterEligible === "no" && u.can_be_business_partner) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.nombre.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const eligibleCount = users.filter(u => u.can_be_business_partner).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Usuarios de Portales — Elegibilidad como Socio</CardTitle>
              <CardDescription className="mt-1">
                Habilita usuarios de portales partner como elegibles para ser configurados como
                <strong> Socios del Portal</strong> por el dueño del portal.
              </CardDescription>
            </div>
          </div>
          <Badge variant="default" className="gap-1">
            <Crown className="w-3 h-3" /> {eligibleCount} elegibles
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nombre o email..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterPortal} onValueChange={setFilterPortal}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los portales</SelectItem>
              {portals.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEligible} onValueChange={setFilterEligible}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Solo elegibles</SelectItem>
              <SelectItem value="no">No elegibles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Elegible como Socio</TableHead>
                <TableHead className="text-center">MLM (red)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin usuarios que coincidan
                  </TableCell>
                </TableRow>
              ) : filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.portal_name}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"} className="text-xs">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={u.can_be_business_partner}
                      onCheckedChange={(v) => toggleEligible(u.id, v)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={!!u.mlm_enabled}
                      onCheckedChange={(v) => toggleMlm(u.id, v)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDemoTarget(u)}>
                        <FlaskConical className="w-3.5 h-3.5" /> Fondos demo
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPwTarget(u)}>
                        <KeyRound className="w-3.5 h-3.5" /> Contraseña
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pwTarget && (
          <ChangePartnerPasswordDialog
            open={!!pwTarget}
            onOpenChange={(o) => { if (!o) setPwTarget(null); }}
            partnerUserId={pwTarget.id}
            partnerUserName={pwTarget.nombre}
            partnerUserEmail={pwTarget.email}
            portalId={pwTarget.portal_id}
          />
        )}

        {demoTarget && (
          <GrantDemoFundsDialog
            open={!!demoTarget}
            onOpenChange={(o) => { if (!o) setDemoTarget(null); }}
            portalId={demoTarget.portal_id}
            userId={demoTarget.id}
            userName={demoTarget.nombre}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerUsersGlobalAdmin;
