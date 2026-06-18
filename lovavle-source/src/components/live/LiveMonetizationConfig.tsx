import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toastUtils";
import { DollarSign, Save, Users, Radio, Heart, Star } from "lucide-react";

interface MonetizationConfig {
  id?: string;
  dolares_por_lead: number;
  bono_visualizaciones_umbral: number;
  bono_visualizaciones_monto: number;
  bono_streams_umbral: number;
  bono_streams_monto: number;
  bono_interacciones_umbral: number;
  bono_interacciones_monto: number;
  bono_votacion_umbral: number;
  bono_votacion_monto: number;
}

const defaultConfig: MonetizationConfig = {
  dolares_por_lead: 0,
  bono_visualizaciones_umbral: 100,
  bono_visualizaciones_monto: 0,
  bono_streams_umbral: 10,
  bono_streams_monto: 0,
  bono_interacciones_umbral: 500,
  bono_interacciones_monto: 0,
  bono_votacion_umbral: 4.0,
  bono_votacion_monto: 0,
};

const LiveMonetizationConfig = () => {
  const [config, setConfig] = useState<MonetizationConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("live_monetization_config")
      .select("*")
      .eq("active", true)
      .limit(1)
      .single();

    if (data) {
      setConfig(data as unknown as MonetizationConfig);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, ...values } = config;

    if (id) {
      const { error } = await supabase
        .from("live_monetization_config")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error("Error: " + error.message);
      else toast.success("Configuración guardada");
    } else {
      const { error } = await supabase
        .from("live_monetization_config")
        .insert({ ...values, active: true });
      if (error) toast.error("Error: " + error.message);
      else {
        toast.success("Configuración creada");
        fetchConfig();
      }
    }
    setSaving(false);
  };

  const updateField = (field: keyof MonetizationConfig, value: number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Configuración de Monetización
        </h3>
        <p className="text-sm text-muted-foreground">Define cuánto se paga a los streamers por su actividad</p>
      </div>

      {/* Lead payout */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Pago por Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap">USD por nuevo lead:</Label>
            <Input
              type="number"
              step="0.01"
              value={config.dolares_por_lead}
              onChange={e => updateField("dolares_por_lead", parseFloat(e.target.value) || 0)}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bonus thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Bono por Visualizaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Umbral (viewers):</Label>
              <Input
                type="number"
                value={config.bono_visualizaciones_umbral}
                onChange={e => updateField("bono_visualizaciones_umbral", parseInt(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Bono USD:</Label>
              <Input
                type="number"
                step="0.01"
                value={config.bono_visualizaciones_monto}
                onChange={e => updateField("bono_visualizaciones_monto", parseFloat(e.target.value) || 0)}
                className="w-28"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-500" /> Bono por Cantidad de Streams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Umbral (streams):</Label>
              <Input
                type="number"
                value={config.bono_streams_umbral}
                onChange={e => updateField("bono_streams_umbral", parseInt(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Bono USD:</Label>
              <Input
                type="number"
                step="0.01"
                value={config.bono_streams_monto}
                onChange={e => updateField("bono_streams_monto", parseFloat(e.target.value) || 0)}
                className="w-28"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" /> Bono por Interacciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Umbral (reacciones):</Label>
              <Input
                type="number"
                value={config.bono_interacciones_umbral}
                onChange={e => updateField("bono_interacciones_umbral", parseInt(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Bono USD:</Label>
              <Input
                type="number"
                step="0.01"
                value={config.bono_interacciones_monto}
                onChange={e => updateField("bono_interacciones_monto", parseFloat(e.target.value) || 0)}
                className="w-28"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" /> Bono por Votación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Rating mínimo (1-5):</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={config.bono_votacion_umbral}
                onChange={e => updateField("bono_votacion_umbral", parseFloat(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Bono USD:</Label>
              <Input
                type="number"
                step="0.01"
                value={config.bono_votacion_monto}
                onChange={e => updateField("bono_votacion_monto", parseFloat(e.target.value) || 0)}
                className="w-28"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar Configuración"}
      </Button>
    </div>
  );
};

export default LiveMonetizationConfig;
