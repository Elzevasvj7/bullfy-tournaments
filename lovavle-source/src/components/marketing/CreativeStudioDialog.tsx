import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mic, Layers, Images, Sparkles } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clipId: string | null;
  defaultText?: string;
}

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (ES/EN)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (EN)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (EN)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (EN)" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice (EN)" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian (EN)" },
];

export default function CreativeStudioDialog({ open, onOpenChange, clipId, defaultText = "" }: Props) {
  const [tab, setTab] = useState("voice");

  // Voiceover
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [voiceText, setVoiceText] = useState(defaultText);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Variants
  const [numVariants, setNumVariants] = useState(3);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Carousel
  const [numCards, setNumCards] = useState(8);
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselResult, setCarouselResult] = useState<any>(null);

  const handleVoiceover = async () => {
    if (!clipId || !voiceText.trim()) return toast.error("Falta texto");
    setVoiceLoading(true);
    try {
      const voice = VOICES.find((v) => v.id === voiceId);
      const { data, error } = await supabase.functions.invoke("generate-clip-voiceover", {
        body: { clip_id: clipId, voice_id: voiceId, voice_name: voice?.name, text: voiceText },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      toast.success("Voiceover en proceso. Revisa la pestaña Voiceovers en unos minutos.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleVariants = async () => {
    if (!clipId) return;
    setVariantsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clip-variants", {
        body: { clip_id: clipId, num_variants: numVariants },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      toast.success(`${data.variants?.length || 0} variantes en renderizado`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setVariantsLoading(false);
    }
  };

  const handleCarousel = async () => {
    if (!clipId) return;
    setCarouselLoading(true);
    setCarouselResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clip-carousel", {
        body: { clip_id: clipId, num_cards: numCards },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      setCarouselResult(data);
      toast.success("Carrusel generado");
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setCarouselLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Creatividad IA</DialogTitle>
          <DialogDescription>Voiceover, variantes A/B y carruseles</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="voice"><Mic className="w-3.5 h-3.5 mr-1.5" /> Voiceover</TabsTrigger>
            <TabsTrigger value="variants"><Layers className="w-3.5 h-3.5 mr-1.5" /> A/B Hooks</TabsTrigger>
            <TabsTrigger value="carousel"><Images className="w-3.5 h-3.5 mr-1.5" /> Carrusel IG</TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="space-y-3 mt-4">
            <div>
              <Label>Voz</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Texto a narrar</Label>
              <Textarea value={voiceText} onChange={(e) => setVoiceText(e.target.value)} rows={5} placeholder="Texto que reemplazará el audio del clip..." />
              <p className="text-xs text-muted-foreground mt-1">{voiceText.length}/2500</p>
            </div>
            <Button onClick={handleVoiceover} disabled={voiceLoading} className="w-full gap-2">
              {voiceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              Generar Voiceover
            </Button>
          </TabsContent>

          <TabsContent value="variants" className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground">
              La IA genera {numVariants} versiones del clip con ganchos diferentes en los primeros 3 segundos para test A/B.
            </div>
            <div>
              <Label>Número de variantes</Label>
              <Input type="number" min={2} max={5} value={numVariants} onChange={(e) => setNumVariants(Number(e.target.value))} />
            </div>
            <Button onClick={handleVariants} disabled={variantsLoading} className="w-full gap-2">
              {variantsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Generar Variantes
            </Button>
          </TabsContent>

          <TabsContent value="carousel" className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground">
              Convierte el clip en un carrusel de Instagram con {numCards} tarjetas. Cada tarjeta lleva imagen generada por IA.
            </div>
            <div>
              <Label>Número de tarjetas (3-10)</Label>
              <Input type="number" min={3} max={10} value={numCards} onChange={(e) => setNumCards(Number(e.target.value))} />
            </div>
            <Button onClick={handleCarousel} disabled={carouselLoading} className="w-full gap-2">
              {carouselLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
              Generar Carrusel
            </Button>

            {carouselResult?.cards && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {carouselResult.cards.map((c: any, i: number) => (
                  <div key={i} className="border border-border rounded p-2 text-xs">
                    {c.image_url && <img src={c.image_url} alt={c.title} className="w-full aspect-square object-cover rounded mb-1" />}
                    <p className="font-semibold line-clamp-1">{c.title}</p>
                    <p className="text-muted-foreground line-clamp-2">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
