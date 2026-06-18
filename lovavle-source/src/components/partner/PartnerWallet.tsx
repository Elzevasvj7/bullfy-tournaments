import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Clock, Info } from "lucide-react";
import { usePortalBrand, brandText } from "@/lib/portalBrand";

interface PartnerWalletProps {
  portalId: string;
}

interface Earning {
  id: string;
  period_start: string;
  period_end: string;
  earnings_total: number;
  earnings_leads: number;
  earnings_bonuses: number;
  status: string;
}

// Vista SOLO-LECTURA de las ganancias de Bullfy Live. El retiro se unificó en la pestaña
// Wallet: al aprobarse, estas ganancias se acreditan al wallet unificado del IB. Aquí solo
// se muestra el detalle por periodo (sin configurar wallet ni solicitar retiro → evita el
// doble retiro con el sistema unificado).
const PartnerWallet = ({ portalId }: PartnerWalletProps) => {
  const { isWhiteLabel } = usePortalBrand();
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchEarnings = async () => {
    const { data } = await supabase
      .from("live_streamer_earnings")
      .select("*")
      .eq("host_id", user!.id)
      .order("period_start", { ascending: false });
    setEarnings((data as unknown as Earning[]) || []);
    setLoading(false);
  };

  const paidTotal = earnings
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.earnings_total), 0);
  const pendingTotal = earnings
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.earnings_total), 0);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando ganancias...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Tus ganancias de {brandText(isWhiteLabel, "Bullfy Live")} se <strong className="text-foreground">acreditan a tu Wallet</strong> cuando un administrador las aprueba.
          Los <strong className="text-foreground">retiros se gestionan desde la pestaña Wallet</strong> (junto con el resto de tus ingresos).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold">${paidTotal.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Aprobado y acreditado al Wallet</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="w-5 h-5 text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold">${pendingTotal.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pendiente de aprobación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> {brandText(isWhiteLabel, "Historial de Ganancias (Bullfy Live)")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p>No hay ganancias registradas aún</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Bonos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
                      {new Date(e.period_start).toLocaleDateString()} - {new Date(e.period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">${Number(e.earnings_leads).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(e.earnings_bonuses).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">${Number(e.earnings_total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "paid" ? "default" : "secondary"}>
                        {e.status === "paid" ? "Aprobado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerWallet;
