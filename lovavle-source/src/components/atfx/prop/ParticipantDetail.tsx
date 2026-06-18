import { useATFX } from "@/hooks/useATFX";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { fmtUSD, fmtNum } from "../utils";

interface Props { id: string; onBack: () => void; }

export default function ParticipantDetail({ id, onBack }: Props) {
  const q = useATFX("participant_detail", { id });
  const p = (q.data?.data as any) ?? {};
  const goals = p.goals || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
      <Card>
        <CardHeader><CardTitle>{p.customer_email} <span className="text-muted-foreground text-sm">— {p.challenge_name}</span></CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs">Status</p><p className="font-semibold">{p.status || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Step actual</p><p>{p.current_step || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Capital</p><p>{fmtUSD(p.initial_balance)}</p></div>
          <div><p className="text-muted-foreground text-xs">Equity actual</p><p>{fmtUSD(p.equity)}</p></div>
          <div><p className="text-muted-foreground text-xs">Iniciado</p><p>{p.started_at || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Resultado</p><p>{p.result || "—"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Objetivos / Reglas</CardTitle></CardHeader>
        <CardContent>
          {goals.length === 0 && <p className="text-sm text-muted-foreground">Sin datos de objetivos.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {goals.map((g: any, i: number) => (
              <div key={i} className="p-3 rounded-md border border-border">
                <p className="text-xs text-muted-foreground">{g.name || g.type}</p>
                <p className="text-sm">Objetivo: <span className="font-semibold">{g.target}</span></p>
                <p className="text-sm">Actual: <span className="font-semibold">{g.current}</span></p>
                <p className="text-xs">{g.passed ? "✅ Cumplido" : "⏳ En curso"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
