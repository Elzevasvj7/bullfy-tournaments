import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Award, Activity } from "lucide-react";

const SCORING_RULES = [
  { label: "Primera participación en stream", points: 10, icon: "🎬" },
  { label: "Cada stream adicional", points: 5, icon: "📺" },
  { label: "Duración > 30 min en un stream", points: 10, icon: "⏱️" },
  { label: "Duración > 60 min en un stream", points: 15, icon: "⏱️" },
  { label: "Tiene teléfono registrado", points: 10, icon: "📱" },
  { label: "Es partner registrado en portal", points: 20, icon: "🤝" },
  { label: "5+ streams atendidos", points: 15, icon: "🔥" },
  { label: "10+ streams atendidos", points: 25, icon: "🏆" },
];

const LeadScoring = () => {
  const { data: leads = [] } = useQuery({
    queryKey: ["stream-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stream_leads").select("*").order("opportunity_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getScoreTier = (score: number) => {
    if (score >= 80) return { label: "Hot 🔥", color: "bg-green-500/10 text-green-500" };
    if (score >= 50) return { label: "Warm 🌡️", color: "bg-yellow-500/10 text-yellow-500" };
    if (score >= 25) return { label: "Cool ❄️", color: "bg-blue-500/10 text-blue-500" };
    return { label: "Cold 🧊", color: "bg-muted text-muted-foreground" };
  };

  const avgScore = leads.length > 0 ? Math.round(leads.reduce((sum: number, l: any) => sum + l.opportunity_score, 0) / leads.length) : 0;
  const hotLeads = leads.filter((l: any) => l.opportunity_score >= 80).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-xs text-muted-foreground">Score promedio</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{hotLeads}</p>
              <p className="text-xs text-muted-foreground">Leads Hot (80+)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{leads.length}</p>
              <p className="text-xs text-muted-foreground">Total leads</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoring rules */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Reglas de Scoring Automático</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Criterio</TableHead>
                <TableHead className="text-right">Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCORING_RULES.map((rule, i) => (
                <TableRow key={i}>
                  <TableCell className="text-lg">{rule.icon}</TableCell>
                  <TableCell className="text-sm">{rule.label}</TableCell>
                  <TableCell className="text-right font-bold text-primary">+{rule.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top leads */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Top Leads por Score</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Streams</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.slice(0, 20).map((lead: any, i: number) => {
                const tier = getScoreTier(lead.opportunity_score);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{lead.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.correo}</TableCell>
                    <TableCell>{lead.stream_count}</TableCell>
                    <TableCell className="font-bold">{lead.opportunity_score}</TableCell>
                    <TableCell>
                      <Badge className={tier.color}>{tier.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadScoring;
