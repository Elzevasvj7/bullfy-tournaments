import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Lock } from "lucide-react";

export default function TournamentElite() {
  return (
    <div className="space-y-6">
      <div className="text-center py-10 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card to-card border border-amber-500/30">
        <Crown className="h-12 w-12 mx-auto text-amber-400 mb-3" />
        <h1 className="text-4xl font-extrabold">Bullfy <span className="text-amber-400">Élite</span></h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Torneos profesionales con cuentas reales fondeadas. Acceso por invitación o KYC aprobado.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Próximamente</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground">
          La sección Élite se habilitará en la siguiente entrega (KYC, pagos en USDT, cuentas reales).
        </CardContent>
      </Card>
    </div>
  );
}
