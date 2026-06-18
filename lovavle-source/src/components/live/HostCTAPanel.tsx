import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toastUtils";
import { Link2, Trash2, Megaphone, Upload, Save, Pencil, X, TrendingUp } from "lucide-react";
import type { LocalParticipant } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

interface CTAItem {
  id: string;
  title: string;
  url: string;
  buttonText: string;
  imagePath?: string | null;
  imageOnly?: boolean;
  displayMode?: string;
  isSaved?: boolean;
}

interface HostCTAPanelProps {
  localParticipant?: LocalParticipant | null;
}

const HostCTAPanel = ({ localParticipant }: HostCTAPanelProps) => {
  const room = useRoomContext();
  const [ctas, setCtas] = useState<CTAItem[]>([]);
  const [activeCTAId, setActiveCTAId] = useState<string | null>(null);
  const [tradeOverlayEnabled, setTradeOverlayEnabled] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newButtonText, setNewButtonText] = useState("Ver más");
  const [tradeSymbol, setTradeSymbol] = useState("XAUUSD");
  const [predictionSymbol, setPredictionSymbol] = useState("XAUUSD");
  const [predictingHost, setPredictingHost] = useState(false);
  const [allowViewerPrediction, setAllowViewerPrediction] = useState(false);
  const [newImageOnly, setNewImageOnly] = useState(false);
  const [newDisplayMode, setNewDisplayMode] = useState<string>("default");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved CTAs
  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;
      const { data } = await supabase
        .from("live_saved_ctas")
        .select("*")
        .eq("user_id", session.session.user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setCtas(data.map((c: any) => ({
          id: c.id,
          title: c.title,
          url: c.url || "",
          buttonText: c.button_text || "Ver más",
          imagePath: c.image_path,
          imageOnly: c.image_only,
          displayMode: c.display_mode || "default",
          isSaved: true,
        })));
      }
    };
    load();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return null;
    const ext = file.name.split(".").pop();
    const path = `${session.session.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("live-cta-images").upload(path, file);
    if (error) { toast.error("Error subiendo imagen"); return null; }
    const { data: urlData } = supabase.storage.from("live-cta-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const resetForm = () => {
    setNewTitle(""); setNewUrl(""); setNewButtonText("Ver más");
    setNewImageOnly(false); setNewDisplayMode("default");
    setImageFile(null); setImagePreview(null);
    setEditingId(null);
  };

  const startEdit = (cta: CTAItem) => {
    setEditingId(cta.id);
    setNewTitle(cta.title);
    setNewUrl(cta.url);
    setNewButtonText(cta.buttonText);
    setNewImageOnly(!!cta.imageOnly);
    setNewDisplayMode(cta.displayMode || "default");
    setImageFile(null);
    setImagePreview(cta.imagePath || null);
  };

  const saveCTA = async () => {
    if (!newTitle.trim()) { toast.error("Título es requerido"); return; }
    if (!newImageOnly && !newUrl.trim()) { toast.error("URL es requerida"); return; }

    setUploading(true);
    let imagePath: string | null = imagePreview; // keep existing if no new file
    if (imageFile) {
      imagePath = await uploadImage(imageFile);
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { setUploading(false); return; }

    if (editingId) {
      // UPDATE existing
      const updateData: any = {
        title: newTitle.trim(),
        url: newUrl.trim() || null,
        button_text: newButtonText.trim() || "Ver más",
        image_only: newImageOnly,
        display_mode: newDisplayMode,
      };
      if (imageFile) updateData.image_path = imagePath;

      const { error } = await supabase.from("live_saved_ctas").update(updateData).eq("id", editingId);
      if (error) { toast.error("Error actualizando CTA"); setUploading(false); return; }

      setCtas(prev => prev.map(c => c.id === editingId ? {
        ...c,
        title: newTitle.trim(),
        url: newUrl.trim(),
        buttonText: newButtonText.trim() || "Ver más",
        imageOnly: newImageOnly,
        displayMode: newDisplayMode,
        ...(imageFile ? { imagePath } : {}),
      } : c));

      toast.success("CTA actualizado");
    } else {
      // INSERT new
      const { data, error } = await supabase.from("live_saved_ctas").insert({
        user_id: session.session.user.id,
        title: newTitle.trim(),
        url: newUrl.trim() || null,
        button_text: newButtonText.trim() || "Ver más",
        image_path: imagePath,
        image_only: newImageOnly,
        display_mode: newDisplayMode,
      }).select().single();

      if (error) { toast.error("Error guardando CTA"); setUploading(false); return; }

      setCtas(prev => [{
        id: data.id,
        title: data.title,
        url: data.url || "",
        buttonText: data.button_text || "Ver más",
        imagePath: data.image_path,
        imageOnly: data.image_only,
        displayMode: data.display_mode || "default",
        isSaved: true,
      }, ...prev]);

      toast.success("CTA guardado");
    }

    resetForm();
    setUploading(false);
  };

  const removeCTA = async (id: string) => {
    if (activeCTAId === id) toggleCTA(id, false);
    await supabase.from("live_saved_ctas").delete().eq("id", id);
    setCtas((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) resetForm();
  };

  const sendDataMessage = useCallback((payload: object) => {
    if (!localParticipant) return;
    const data = new TextEncoder().encode(JSON.stringify(payload));
    localParticipant.publishData(data, { reliable: true });
  }, [localParticipant]);

  const toggleCTA = useCallback((id: string, activate: boolean) => {
    if (!localParticipant) { toast.error("Conéctate al stream primero"); return; }
    if (activate) {
      const cta = ctas.find((c) => c.id === id);
      if (!cta) return;
      setActiveCTAId(id);
      const payload = {
        type: "cta", action: "show",
        title: cta.title, url: cta.url, buttonText: cta.buttonText,
        imagePath: cta.imagePath, imageOnly: cta.imageOnly,
        displayMode: cta.displayMode,
      };
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-cta", { detail: payload }));
      toast.success("CTA activado para los viewers");
    } else {
      setActiveCTAId(null);
      const payload = { type: "cta", action: "hide" };
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-cta", { detail: payload }));
      toast.info("CTA desactivado");
    }
  }, [ctas, sendDataMessage, localParticipant]);

  const toggleTradeOverlay = useCallback((activate: boolean) => {
    if (!localParticipant) {
      toast.error("Conéctate al stream primero");
      return;
    }

    if (activate) {
      const payload = {
        type: "trade_cta",
        action: "show",
        symbol: tradeSymbol.trim().toUpperCase() || "XAUUSD",
      };
      setTradeOverlayEnabled(true);
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
      toast.success("Operar ahora activado para viewers");
      return;
    }

    const payload = { type: "trade_cta", action: "hide" };
    setTradeOverlayEnabled(false);
    sendDataMessage(payload);
    window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
    toast.info("Operar ahora ocultado");
  }, [localParticipant, sendDataMessage, tradeSymbol]);

  const requestHostPrediction = useCallback(async () => {
    if (!localParticipant) {
      toast.error("Conéctate al stream primero");
      return;
    }
    const symbol = predictionSymbol.trim().toUpperCase();
    if (!symbol) {
      toast.error("Indica un símbolo");
      return;
    }

    setPredictingHost(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const { data, error } = await supabase.functions.invoke("live-trend-prediction", {
        body: {
          symbol,
          host_broadcast: true,
          requester_id: userId ?? null,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo generar la predicción");

      const payload = {
        type: "trend_prediction",
        action: "show",
        symbol,
        prediction: {
          trend: data.prediction?.trend ?? "neutral",
          confidence: data.prediction?.confidence ?? "media",
          summary: data.prediction?.summary ?? "",
          newsAlert: data.prediction?.news_alert ?? null,
          redFolderEvents: Array.isArray(data.prediction?.red_folder_events)
            ? data.prediction.red_folder_events
            : [],
        },
        broadcastedBy: "host",
      };
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
      toast.success("Predicción enviada a los viewers");
    } catch (err: any) {
      toast.error(err.message || "Error generando la predicción");
    } finally {
      setPredictingHost(false);
    }
  }, [localParticipant, predictionSymbol, sendDataMessage]);

  const hideHostPrediction = useCallback(() => {
    if (!localParticipant) return;
    const payload = { type: "trend_prediction", action: "hide" };
    sendDataMessage(payload);
    window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
    toast.info("Predicción ocultada");
  }, [localParticipant, sendDataMessage]);

  // Broadcast the "viewer-prediction-allowed" flag whenever it changes,
  // and re-broadcast on demand when a viewer asks for it.
  const allowViewerPredictionRef = useRef(allowViewerPrediction);
  useEffect(() => { allowViewerPredictionRef.current = allowViewerPrediction; }, [allowViewerPrediction]);

  useEffect(() => {
    if (!localParticipant) return;
    sendDataMessage({ type: "viewer_prediction_permission", allowed: allowViewerPrediction });
  }, [allowViewerPrediction, localParticipant, sendDataMessage]);

  // Reply to viewers asking what the current permission is (e.g. on join)
  useEffect(() => {
    if (!room || !localParticipant) return;
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "viewer_prediction_permission_request") {
          sendDataMessage({ type: "viewer_prediction_permission", allowed: allowViewerPredictionRef.current });
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, localParticipant, sendDataMessage]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" /> CTAs Guardados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Operar ahora</p>
              <p className="text-xs text-muted-foreground">Envía el símbolo al viewer para que él defina lote, SL y TP.</p>
            </div>
            <Switch checked={tradeOverlayEnabled} onCheckedChange={toggleTradeOverlay} />
          </div>

          <div>
            <div>
              <Label className="text-xs">Símbolo</Label>
              <Input value={tradeSymbol} onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())} className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="w-full px-2 text-[11px] min-w-0" onClick={() => toggleTradeOverlay(true)}>
              <span className="truncate">Activar</span>
            </Button>
            <Button size="sm" variant="ghost" className="w-full px-2 text-[11px] min-w-0" onClick={() => toggleTradeOverlay(false)}>
              <span className="truncate">Ocultar</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Predicción Tendencia</p>
              <p className="text-xs text-muted-foreground">Genera análisis IA y muéstralo a todos los viewers.</p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Símbolo a analizar</Label>
            <Input value={predictionSymbol} onChange={(e) => setPredictionSymbol(e.target.value.toUpperCase())} className="h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="w-full px-2 text-[11px] min-w-0" disabled={predictingHost} onClick={requestHostPrediction}>
              <span className="truncate">{predictingHost ? "Analizando..." : "Generar"}</span>
            </Button>
            <Button size="sm" variant="ghost" className="w-full px-2 text-[11px] min-w-0" onClick={hideHostPrediction}>
              <span className="truncate">Ocultar</span>
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <div>
              <p className="text-xs font-medium text-foreground">Permitir que viewers generen su propia predicción</p>
              <p className="text-[11px] text-muted-foreground">Si está apagado, solo tú puedes mostrarles la predicción.</p>
            </div>
            <Switch checked={allowViewerPrediction} onCheckedChange={setAllowViewerPrediction} />
          </div>
        </div>


        <div className="space-y-2 p-3 border border-dashed border-border rounded-lg">
          {editingId && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-primary">Editando CTA</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={resetForm}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej: ¡Abre tu cuenta ahora!" className="h-8 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="imageOnly" checked={newImageOnly}
              onCheckedChange={(c) => setNewImageOnly(!!c)} />
            <Label htmlFor="imageOnly" className="text-xs">Solo mostrar imagen/GIF/video</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="bannerStrip" checked={newDisplayMode === "banner_strip"}
              onCheckedChange={(c) => setNewDisplayMode(c ? "banner_strip" : "default")} />
            <Label htmlFor="bannerStrip" className="text-xs">Cintillo superior (banner horizontal)</Label>
          </div>

          {!newImageOnly && (
            <>
              <div>
                <Label className="text-xs">URL destino</Label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..." className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Texto del botón</Label>
                <Input value={newButtonText} onChange={(e) => setNewButtonText(e.target.value)}
                  placeholder="Ver más" className="h-8 text-sm" />
              </div>
            </>
          )}

          {newImageOnly && (
            <div>
              <Label className="text-xs">URL al hacer click (opcional)</Label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://... (opcional)" className="h-8 text-sm" />
            </div>
          )}

          <div>
            <Label className="text-xs">Imagen</Label>
            <input ref={fileInputRef} type="file" accept="image/*,image/gif,video/mp4,video/webm" className="hidden" onChange={handleFileSelect} />
            <Button size="sm" variant="outline" className="w-full gap-1 h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3" /> {imageFile ? imageFile.name : "Subir imagen"}
            </Button>
            {imagePreview && (
              <img src={imagePreview} alt="preview" className="mt-2 rounded border border-border max-h-20 w-full object-contain" />
            )}
          </div>

          <Button size="sm" onClick={saveCTA} className="w-full gap-1" variant="outline" disabled={uploading}>
            <Save className="w-3 h-3" /> {uploading ? "Guardando..." : editingId ? "Actualizar CTA" : "Guardar CTA"}
          </Button>
        </div>

        {/* CTA list */}
        {ctas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No hay CTAs guardados</p>
        )}
        {ctas.map((cta) => {
          const isActive = activeCTAId === cta.id;
          return (
            <div key={cta.id}
              className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                isActive ? "border-primary bg-primary/5" : "border-border"
              }`}>
              <div className="flex-1 min-w-0 mr-2">
                <p className="font-medium truncate">{cta.title}</p>
                {cta.imagePath && (
                  <img src={cta.imagePath} alt={cta.title} className="mt-1 rounded border border-border w-full object-contain max-h-24" />
                )}
                {cta.url && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                    <Link2 className="w-3 h-3 shrink-0" /> {cta.url}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={isActive} onCheckedChange={(checked) => toggleCTA(cta.id, checked)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(cta)}>
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCTA(cta.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default HostCTAPanel;
