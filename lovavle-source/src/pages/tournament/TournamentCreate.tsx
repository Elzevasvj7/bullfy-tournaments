import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SUPPORTED_TIMEZONES, detectBrowserTimezone } from "@/lib/timezones";

function localToUtcISO(local: string, tz: string): string {
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  const hour = o.hour === "24" ? 0 : Number(o.hour);
  const asTzMs = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day), hour, Number(o.minute), Number(o.second));
  const offset = asTzMs - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export default function TournamentCreate() {
  const { user, token, loading: authLoading } = useTournamentAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", modality: "standard",
    starts_at: "", ends_at: "",
    max_participants: 20, starting_balance_usd: 10000,
    timezone: detectBrowserTimezone(),
    league: "bmoney" as "bmoney" | "elite",
    entry_fee_bmoney: 100,
    entry_fee_usd: 0,
    allows_funded_mt5: false,
    min_funded_equity_usd: 1000,
    house_fee_pct: 25,
  });

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const startsISO = form.starts_at ? localToUtcISO(form.starts_at, form.timezone) : "";
      const endsISO = form.ends_at ? localToUtcISO(form.ends_at, form.timezone) : "";
      if (!startsISO || !endsISO) { toast.error("Fechas requeridas"); return; }
      if (new Date(endsISO) <= new Date(startsISO)) { toast.error("La fecha de fin debe ser posterior al inicio"); return; }

      const payload: any = {
        name: form.name, description: form.description, modality: form.modality,
        starts_at: startsISO, ends_at: endsISO, registration_closes_at: startsISO,
        max_participants: form.max_participants, starting_balance_usd: form.starting_balance_usd,
        league: form.league, house_fee_pct: form.house_fee_pct,
      };
      if (form.league === "bmoney") {
        payload.entry_fee_bmoney = form.entry_fee_bmoney;
      } else {
        payload.entry_fee_usd = form.entry_fee_usd;
        payload.allows_funded_mt5 = form.allows_funded_mt5;
        if (form.allows_funded_mt5) payload.min_funded_equity_usd = form.min_funded_equity_usd;
      }

      const { data, error } = await supabase.functions.invoke("tournament-create", {
        body: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
      toast.success("¡Torneo creado!");
      nav(`/tournament/t/${data.tournament.slug}`);
    } finally { setLoading(false); }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Crear torneo</CardTitle>
        <p className="text-sm text-muted-foreground">Elige liga BMoney (ficticio) o Élite (dinero real). Máx 2 torneos por día.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {/* Liga */}
          <div className="space-y-2">
            <Label>Liga</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => setForm({ ...form, league: "bmoney" })}
                className={`p-3 rounded-lg border text-left ${form.league === "bmoney" ? "border-[#B6FF3D] bg-[#B6FF3D]/10" : "border-border"}`}>
                <div className="font-bold text-sm">BMoney</div>
                <div className="text-[11px] text-muted-foreground">Ficticio. Sin riesgo. Premios en BM$.</div>
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, league: "elite" })}
                className={`p-3 rounded-lg border text-left ${form.league === "elite" ? "border-[#00E5FF] bg-[#00E5FF]/10" : "border-border"}`}>
                <div className="font-bold text-sm">Élite</div>
                <div className="text-[11px] text-muted-foreground">Dinero real USD. Requiere KYC.</div>
              </button>
            </div>
          </div>

          <div className="space-y-2"><Label>Nombre</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Descripción</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Modalidad</Label>
              <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Estándar</SelectItem>
                  <SelectItem value="pro">Pro (grupos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Máx participantes</Label>
              <Input type="number" min={2} max={500} value={form.max_participants}
                onChange={(e) => setForm({ ...form, max_participants: parseInt(e.target.value) })} /></div>

            {form.league === "bmoney" ? (
              <div className="space-y-2 col-span-2"><Label>Costo de entrada (BM$)</Label>
                <Input type="number" min={0} value={form.entry_fee_bmoney}
                  onChange={(e) => setForm({ ...form, entry_fee_bmoney: parseFloat(e.target.value) })} /></div>
            ) : (
              <>
                <div className="space-y-2"><Label>Costo de entrada (USD)</Label>
                  <Input type="number" min={0} value={form.entry_fee_usd}
                    onChange={(e) => setForm({ ...form, entry_fee_usd: parseFloat(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Comisión casa (%)</Label>
                  <Input type="number" min={0} max={50} value={form.house_fee_pct}
                    onChange={(e) => setForm({ ...form, house_fee_pct: parseFloat(e.target.value) })} /></div>
                <div className="col-span-2 flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="text-sm font-medium">Permitir cuenta MT5 fondeada</div>
                    <div className="text-[11px] text-muted-foreground">Los participantes podrán usar su cuenta real en lugar de demo.</div>
                  </div>
                  <Switch checked={form.allows_funded_mt5} onCheckedChange={(v) => setForm({ ...form, allows_funded_mt5: v })} />
                </div>
                {form.allows_funded_mt5 && (
                  <div className="space-y-2 col-span-2"><Label>Equity mínima fondeada (USD)</Label>
                    <Input type="number" min={0} value={form.min_funded_equity_usd}
                      onChange={(e) => setForm({ ...form, min_funded_equity_usd: parseFloat(e.target.value) })} /></div>
                )}
              </>
            )}

            <div className="space-y-2 col-span-2"><Label>Zona horaria</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Inicia</Label>
              <Input type="datetime-local" required value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div className="space-y-2"><Label>Termina</Label>
              <Input type="datetime-local" required value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Balance inicial MT5 (USD)</Label>
              <Input type="number" value={form.starting_balance_usd}
                onChange={(e) => setForm({ ...form, starting_balance_usd: parseFloat(e.target.value) })} />
              <p className="text-[11px] text-muted-foreground">Capital de trading dentro del torneo. Independiente del costo de entrada.</p>
            </div>
          </div>

          <div className="p-3 rounded border bg-muted/30 text-xs text-muted-foreground">
            Distribución de premios: 50% / 30% / 20% (después de {form.house_fee_pct}% fee). Máximo 2 torneos por día por usuario.
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear torneo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
