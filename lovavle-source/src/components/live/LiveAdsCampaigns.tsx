import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toastUtils";
import { Plus, Trash2, Eye, Radio, Image as ImageIcon, Clock, Timer, Link, ExternalLink } from "lucide-react";

interface AdCampaign {
  id: string;
  name: string;
  image_path: string;
  frequency_seconds: number;
  duration_seconds: number;
  active: boolean;
  created_at: string;
  cta_url: string | null;
}

const LiveAdsCampaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [frequencyMinutes, setFrequencyMinutes] = useState(5);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [ctaUrl, setCtaUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("live_ad_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data as unknown as AdCampaign[]) || []);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const resetWizard = () => {
    setStep(1);
    setCampaignName("");
    setImageFile(null);
    setImagePreview(null);
    setFrequencyMinutes(5);
    setDurationSeconds(10);
    setCtaUrl("");
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!imageFile || !campaignName.trim() || !user) return;
    setCreating(true);

    const ext = imageFile.name.split(".").pop() || "jpg";
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("live-ads")
      .upload(filePath, imageFile, { contentType: imageFile.type });

    if (uploadErr) {
      toast.error("Error al subir imagen: " + uploadErr.message);
      setCreating(false);
      return;
    }

    const { error: insertErr } = await supabase.from("live_ad_campaigns").insert({
      name: campaignName.trim(),
      image_path: filePath,
      frequency_seconds: frequencyMinutes * 60,
      duration_seconds: durationSeconds,
      cta_url: ctaUrl.trim() || null,
      active: true,
      created_by: user.id,
    } as any);

    if (insertErr) {
      toast.error("Error: " + insertErr.message);
    } else {
      toast.success("Campaña creada exitosamente");
      setShowWizard(false);
      resetWizard();
      fetchCampaigns();
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("live_ad_campaigns").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
    fetchCampaigns();
  };

  const handleDelete = async (id: string, imagePath: string) => {
    await supabase.storage.from("live-ads").remove([imagePath]);
    await supabase.from("live_ad_campaigns").delete().eq("id", id);
    toast.success("Campaña eliminada");
    fetchCampaigns();
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("live-ads").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" /> Ads Bullfy Live
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configura banners publicitarios que aparecerán durante los streams
          </p>
        </div>
        <Dialog open={showWizard} onOpenChange={(open) => { setShowWizard(open); if (!open) resetWizard(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nueva Campaña</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {step === 1 && "Paso 1: Imagen del Banner"}
                {step === 2 && "Paso 2: Nombre de Campaña"}
                {step === 3 && "Paso 3: Enlace CTA (Opcional)"}
                {step === 4 && "Paso 4: Frecuencia y Duración"}
              </DialogTitle>
            </DialogHeader>

            {/* Step 1: Image upload */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                      <Button variant="outline" size="sm" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                        Cambiar imagen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Sube la imagen del banner (max 5MB)</p>
                      <p className="text-xs text-muted-foreground">Recomendado: 728×90px o 320×50px</p>
                      <Label htmlFor="ad-image" className="cursor-pointer">
                        <Button variant="outline" asChild><span>Seleccionar Imagen</span></Button>
                      </Label>
                      <input id="ad-image" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!imageFile}>Siguiente</Button>
                </div>
              </div>
            )}

            {/* Step 2: Campaign name */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Nombre de campaña o evento</Label>
                  <Input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder="Ej: Promo Navidad 2026"
                    maxLength={100}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                  <Button onClick={() => setStep(3)} disabled={!campaignName.trim()}>Siguiente</Button>
                </div>
              </div>
            )}

            {/* Step 3: CTA URL (optional) */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <Link className="w-4 h-4 text-primary" /> URL de destino al hacer clic
                  </Label>
                  <Input
                    value={ctaUrl}
                    onChange={e => setCtaUrl(e.target.value)}
                    placeholder="https://ejemplo.com/promo (dejar vacío si no aplica)"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Si se configura, los viewers podrán hacer clic en el banner para visitar este enlace.
                  </p>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
                  <Button onClick={() => setStep(4)}>Siguiente</Button>
                </div>
              </div>
            )}

            {/* Step 4: Frequency & Duration */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Frecuencia de aparición
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Mostrar cada</span>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={frequencyMinutes}
                      onChange={e => setFrequencyMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">minutos</span>
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" /> Duración en pantalla
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Visible durante</span>
                    <Input
                      type="number"
                      min={3}
                      max={60}
                      value={durationSeconds}
                      onChange={e => setDurationSeconds(Math.max(3, parseInt(e.target.value) || 10))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">segundos</span>
                  </div>
                </div>

                {/* Preview summary */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 text-sm space-y-1">
                    <p><strong>Campaña:</strong> {campaignName}</p>
                    {ctaUrl && <p><strong>CTA:</strong> {ctaUrl}</p>}
                    <p><strong>Frecuencia:</strong> cada {frequencyMinutes} min</p>
                    <p><strong>Duración:</strong> {durationSeconds}s en pantalla</p>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>Atrás</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? "Creando..." : "Crear Campaña"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaigns list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando campañas...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No hay campañas de ads creadas</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primera campaña para empezar a mostrar banners en los streams</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campañas Activas ({campaigns.filter(c => c.active).length}/{campaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banner</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead className="text-center">Frecuencia</TableHead>
                  <TableHead className="text-center">Duración</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <img
                        src={getImageUrl(c.image_path)}
                        alt={c.name}
                        className="h-10 w-auto max-w-[160px] rounded object-contain bg-muted"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {(c as any).cta_url ? (
                        <a href={(c as any).cta_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Link
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      c/{Math.round(c.frequency_seconds / 60)} min
                    </TableCell>
                    <TableCell className="text-center text-sm">{c.duration_seconds}s</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.active}
                        onCheckedChange={v => handleToggle(c.id, v)}
                      />
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                            <AlertDialogDescription>Se eliminará "{c.name}" y su imagen asociada.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c.id, c.image_path)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveAdsCampaigns;
