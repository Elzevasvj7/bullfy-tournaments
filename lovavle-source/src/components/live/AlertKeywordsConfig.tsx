import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toastUtils";
import { AlertTriangle, Plus, Trash2, Shield, Tag } from "lucide-react";

const CATEGORIES = [
  { value: "compliance", label: "Compliance" },
  { value: "ventas", label: "Ventas" },
  { value: "riesgo", label: "Riesgo" },
  { value: "general", label: "General" },
];

const AlertKeywordsConfig = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ["alert-keywords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_alert_keywords")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addKeyword = useMutation({
    mutationFn: async () => {
      const trimmed = newKeyword.trim().toLowerCase();
      if (!trimmed) return;
      const { error } = await supabase.from("live_alert_keywords").insert({
        keyword: trimmed,
        category: newCategory,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-keywords"] });
      setNewKeyword("");
      toast.success("Palabra clave agregada");
    },
    onError: () => toast.error("Error al agregar"),
  });

  const toggleKeyword = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("live_alert_keywords")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-keywords"] }),
  });

  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("live_alert_keywords").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-keywords"] });
      toast.success("Palabra eliminada");
    },
  });

  const categoryColor = (cat: string) => {
    switch (cat) {
      case "compliance": return "bg-destructive/10 text-destructive border-destructive/20";
      case "ventas": return "bg-primary/10 text-primary border-primary/20";
      case "riesgo": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-5 h-5 text-destructive" />
          Configuración de Alertas por Palabras Clave
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Define palabras o frases que generarán alertas automáticas cuando sean detectadas en un stream.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new keyword */}
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Ej: rendimiento garantizado"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addKeyword.mutate()}
          />
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => addKeyword.mutate()} disabled={!newKeyword.trim() || addKeyword.isPending} size="sm" className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </Button>
        </div>

        {/* Keywords list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
          {keywords.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No hay palabras configuradas</p>
              <p className="text-xs text-muted-foreground">Agrega palabras o frases para monitorear en streams</p>
            </div>
          )}
          {keywords.map((kw: any) => (
            <div key={kw.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <Switch
                checked={kw.active}
                onCheckedChange={(checked) => toggleKeyword.mutate({ id: kw.id, active: checked })}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{kw.keyword}</span>
              </div>
              <Badge className={`text-[10px] ${categoryColor(kw.category)}`}>
                <Tag className="w-2.5 h-2.5 mr-1" />
                {kw.category}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteKeyword.mutate(kw.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {keywords.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            {keywords.filter((k: any) => k.active).length} de {keywords.length} palabras activas
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertKeywordsConfig;
