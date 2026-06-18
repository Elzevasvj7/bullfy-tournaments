import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/lib/toastUtils";
import { Crown, Layers, KeyRound } from "lucide-react";
import ChangePartnerPasswordDialog from "@/components/partner/ChangePartnerPasswordDialog";
import PortalTiersAdmin from "@/components/partner/PortalTiersAdmin";
import { usePortalTiers } from "@/hooks/usePortalTiers";

interface PartnerTierManagerProps {
  portalId: string;
}

interface PartnerUser {
  id: string;
  nombre: string;
  email: string;
  tier: string;
  status: string;
}

const PartnerTierManager = ({ portalId }: PartnerTierManagerProps) => {
  const { tiers, refetch, labelFor } = usePortalTiers(portalId);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManagePassword, setCanManagePassword] = useState(false);
  const [pwTarget, setPwTarget] = useState<PartnerUser | null>(null);

  const activeTiers = tiers.filter(t => t.active);

  useEffect(() => {
    fetchUsers();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { data } = await supabase.rpc("is_portal_admin", { _portal_id: portalId });
    setCanManagePassword(data === true);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("partner_users")
      .select("id, nombre, email, tier, status")
      .eq("portal_id", portalId)
      .eq("status", "approved")
      .order("nombre");
    setUsers((data as PartnerUser[]) || []);
    setLoading(false);
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const oldTier = user.tier;
    const { error } = await supabase
      .from("partner_users")
      .update({ tier: newTier })
      .eq("id", userId);

    if (error) {
      toast.error("Error: " + error.message);
      return;
    }

    await supabase.from("partner_tier_upgrades").insert({
      partner_user_id: userId,
      portal_id: portalId,
      old_tier: oldTier,
      new_tier: newTier,
      upgrade_method: "manual",
      performed_by: "admin",
    });

    toast.success(`${user.nombre} cambiado a ${labelFor(newTier)}`);
    fetchUsers();
  };

  const tierBadge = (tier: string) => (
    <Badge variant="outline" className="gap-1">
      <Layers className="w-3 h-3 text-primary" />
      {labelFor(tier)}
    </Badge>
  );

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      {/* CRUD de niveles propios del IB */}
      <PortalTiersAdmin portalId={portalId} tiers={tiers} onChanged={refetch} />

      {/* Resumen de usuarios por nivel */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {activeTiers.map(t => (
          <Card key={t.id}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Layers className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.tier === t.slug).length}</p>
                <p className="text-sm text-muted-foreground">{t.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" /> Clientes/Niveles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Nivel Actual</TableHead>
                <TableHead>Cambiar Nivel</TableHead>
                {canManagePassword && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{tierBadge(u.tier)}</TableCell>
                  <TableCell>
                    <Select value={u.tier} onValueChange={v => handleTierChange(u.id, v)}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTiers.map(t => (
                          <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {canManagePassword && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPwTarget(u)}>
                        <KeyRound className="w-3.5 h-3.5" /> Contraseña
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManagePassword ? 5 : 4} className="text-center text-muted-foreground py-8">No hay clientes aprobados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pwTarget && (
        <ChangePartnerPasswordDialog
          open={!!pwTarget}
          onOpenChange={(o) => { if (!o) setPwTarget(null); }}
          partnerUserId={pwTarget.id}
          partnerUserName={pwTarget.nombre}
          partnerUserEmail={pwTarget.email}
          portalId={portalId}
        />
      )}
    </div>
  );
};

export default PartnerTierManager;
