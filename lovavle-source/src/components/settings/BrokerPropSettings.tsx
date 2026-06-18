import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { DEFAULT_BROKER_GAIN, useBrokerPropSettings } from "@/hooks/useBrokerPropSettings";

const BrokerPropSettings = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useBrokerPropSettings();
  const [gananciaBroker, setGananciaBroker] = useState<number>(DEFAULT_BROKER_GAIN);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setGananciaBroker(data.gananciaBroker);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("broker_prop_settings").upsert({
      id: 1,
      ganancia_broker: gananciaBroker,
    });

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      await queryClient.invalidateQueries({ queryKey: ["broker-prop-settings"] });
      toast({ title: "Ganancia Broker actualizada" });
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando parámetro...
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-secondary/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Ganancia Broker</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Este valor alimenta el campo <span className="font-medium text-foreground">Bullfy ($)</span> y modifica el spread final del cliente en los cálculos de brokeraje.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 max-w-xs w-full">
          <Label htmlFor="ganancia-broker">Bullfy ($) por lote</Label>
          <Input
            id="ganancia-broker"
            type="number"
            min={0}
            step="0.5"
            value={gananciaBroker}
            onChange={(e) => setGananciaBroker(Number(e.target.value))}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : "Guardar parámetro"}
        </Button>
      </div>
    </section>
  );
};

export default BrokerPropSettings;