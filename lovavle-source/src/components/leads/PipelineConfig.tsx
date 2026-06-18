import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/lib/toastUtils";

const PipelineConfig = () => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6B7280");
  const [newIsClosed, setNewIsClosed] = useState(false);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["lead-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_pipeline_stages")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const addStage = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nombre requerido");
      const maxOrder = stages.length > 0 ? Math.max(...stages.map((s: any) => s.display_order)) + 1 : 0;
      const { error } = await supabase.from("lead_pipeline_stages").insert({
        name: newName.trim(),
        color: newColor,
        display_order: maxOrder,
        is_closed: newIsClosed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
      setNewName("");
      setNewColor("#6B7280");
      setNewIsClosed(false);
      toast.success("Etapa creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
      toast.success("Etapa eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Etapas del Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage: any) => (
                  <TableRow key={stage.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        {stage.display_order}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: stage.color }} />
                    </TableCell>
                    <TableCell className="font-medium">{stage.name}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stage.is_closed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {stage.is_closed ? "Cerrado" : "Abierto"}
                      </span>
                    </TableCell>
                    <TableCell>{stage.is_default ? "✓" : ""}</TableCell>
                    <TableCell>
                      {!stage.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => deleteStage.mutate(stage.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-3">Agregar nueva etapa</h4>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: En revisión" className="w-48" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-16 h-10 p-1" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newIsClosed} onCheckedChange={setNewIsClosed} />
                <Label className="text-xs">Es etapa de cierre</Label>
              </div>
              <Button onClick={() => addStage.mutate()} disabled={addStage.isPending} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PipelineConfig;
