import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Layers, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const ACCOUNT_SIZES = [
  { label: "$5K", price: 59, balance: 5000 },
  { label: "$10K", price: 99, balance: 10000 },
  { label: "$25K", price: 199, balance: 25000 },
  { label: "$50K", price: 299, balance: 50000 },
  { label: "$100K", price: 499, balance: 100000 },
  { label: "$200K", price: 899, balance: 200000 },
];

const PropFirmSimulator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, triggerBenefitMilestone } = useExperienceStore();
  const [accountsSold, setAccountsSold] = useState(20);
  const [selectedAccount, setSelectedAccount] = useState(ACCOUNT_SIZES[2]);
  const [commissionPct, setCommissionPct] = useState(15);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const revenuePerAccount = selectedAccount.price * (commissionPct / 100);
    const monthly = Math.round(accountsSold * revenuePerAccount);
    const res = { monthly, quarterly: monthly * 3, annual: monthly * 12, perAccount: Math.round(revenuePerAccount) };
    setResults(res);
    addToolUsed("propfirm");
    incrementSimulations();
    triggerBenefitMilestone(Math.max(res.monthly, res.quarterly, res.annual));
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "propfirm", inputs: { accountsSold, accountSize: selectedAccount.label, commissionPct }, results: res }); } catch {}
  };

  const chartData = results ? [
    { period: "Mes", ingreso: results.monthly },
    { period: "Trimestre", ingreso: results.quarterly },
    { period: "Año", ingreso: results.annual },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-primary" />PropFirm Profit Simulator</h1>
        <p className="text-muted-foreground">Simula tus ingresos por venta de cuentas de fondeo</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Cuentas vendidas / mes</Label><Input type="number" value={accountsSold} onChange={e => setAccountsSold(+e.target.value)} min={1} /></div>
            <div className="space-y-2">
              <Label>Tamaño de cuenta</Label>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_SIZES.map(a => (
                  <Badge key={a.label} variant={selectedAccount.label === a.label ? "default" : "outline"} className="cursor-pointer justify-center" onClick={() => setSelectedAccount(a)}>
                    {a.label} (${a.price})
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Comisión (%)</Label><Input type="number" value={commissionPct} onChange={e => setCommissionPct(+e.target.value)} min={1} max={50} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand"><TrendingUp className="w-4 h-4 mr-2" />Calcular Ingresos</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {results ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">${results.monthly.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Mensual</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">${results.annual.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Anual</p></CardContent></Card>
              </div>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Ingreso"]} /><Bar dataKey="ingreso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><Layers className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Configura las ventas de cuentas de fondeo</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default PropFirmSimulator;
