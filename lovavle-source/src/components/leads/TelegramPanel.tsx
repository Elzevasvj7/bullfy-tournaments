import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Send, Volume2, Image as ImageIcon, FileText, Loader2, Phone, AlertCircle, Link2, Copy, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { format } from "date-fns";

interface Lead {
  id: string;
  nombre: string;
  telegram_chat_id?: number | null;
  telegram_username?: string | null;
  telegram_last_seen_at?: string | null;
}

interface BrandVoice {
  id: string;
  name: string;
  voice_id: string;
  description?: string;
}

interface Props {
  lead: Lead;
}

const TelegramPanel = ({ lead }: Props) => {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [stability, setStability] = useState(0.5);
  const [sending, setSending] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaKind, setMediaKind] = useState<"photo" | "document">("photo");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: brandVoices = [] } = useQuery({
    queryKey: ["telegram-brand-voices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("config")
        .eq("service_name", "lead_system_config")
        .maybeSingle();
      const cfg = (data?.config as any) ?? {};
      return (cfg.brand_voices ?? []) as BrandVoice[];
    },
  });

  useEffect(() => {
    if (!voiceId && brandVoices[0]) setVoiceId(brandVoices[0].voice_id);
  }, [brandVoices, voiceId]);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["telegram-messages", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_messages")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (!lead.telegram_chat_id) {
    return <UnlinkedState leadId={lead.id} leadName={lead.nombre} />;
  }

  const online = lead.telegram_last_seen_at
    ? (Date.now() - new Date(lead.telegram_last_seen_at).getTime()) < 5 * 60 * 1000
    : false;

  async function sendText() {
    if (!text.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("telegram-send", {
      body: { lead_id: lead.id, text: text.trim() },
    });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Error al enviar");
      return;
    }
    setText("");
    refetch();
  }

  async function sendVoice() {
    if (!voiceText.trim() || !voiceId) {
      toast.error("Texto y voz requeridos");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("telegram-send-voice", {
      body: { lead_id: lead.id, text: voiceText.trim(), voice_id: voiceId, stability },
    });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Error al generar/enviar voz");
      return;
    }
    setVoiceText("");
    refetch();
  }

  async function sendMedia() {
    if (!mediaUrl.trim()) return;
    setSending(true);
    const body: any = { lead_id: lead.id, caption: mediaCaption || undefined };
    if (mediaKind === "photo") body.photo_url = mediaUrl;
    else body.document_url = mediaUrl;
    const { data, error } = await supabase.functions.invoke("telegram-send", { body });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Error al enviar");
      return;
    }
    setMediaUrl("");
    setMediaCaption("");
    refetch();
  }

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground"}`} />
          <span className="text-sm font-medium">@{lead.telegram_username || "sin username"}</span>
          {online ? <Badge variant="outline" className="text-xs">Online</Badge> : null}
        </div>
        {lead.telegram_username && (
          <a
            href={`tg://resolve?domain=${lead.telegram_username}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Phone className="w-3 h-3" /> Llamar en Telegram
          </a>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground italic">Aún no hay mensajes</p>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}>
                {m.kind === "voice" && m.media_url ? (
                  <audio controls src={m.media_url} className="h-8" />
                ) : null}
                {m.kind === "photo" && m.media_url ? (
                  <img src={m.media_url} alt="" className="rounded mb-1 max-h-40" />
                ) : null}
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                <p className={`text-[10px] mt-1 opacity-60`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <Tabs defaultValue="text" className="border-t border-border">
        <TabsList className="w-full justify-start rounded-none">
          <TabsTrigger value="text"><Send className="w-3 h-3 mr-1" /> Texto</TabsTrigger>
          <TabsTrigger value="voice"><Volume2 className="w-3 h-3 mr-1" /> Voz TTS</TabsTrigger>
          <TabsTrigger value="media"><ImageIcon className="w-3 h-3 mr-1" /> Adjuntar</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="p-3 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu mensaje..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />
          <Button onClick={sendText} disabled={sending || !text.trim()} size="sm" className="w-full">
            {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
            Enviar
          </Button>
        </TabsContent>

        <TabsContent value="voice" className="p-3 space-y-2">
          {brandVoices.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No hay voces de marca configuradas. Ve a Settings → Lead System → Voces de Marca.
            </p>
          ) : (
            <>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger><SelectValue placeholder="Selecciona voz" /></SelectTrigger>
                <SelectContent>
                  {brandVoices.map((v) => (
                    <SelectItem key={v.id} value={v.voice_id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="Texto que dirá la voz..."
                rows={3}
              />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Estabilidad: {stability.toFixed(2)}</label>
                <Slider value={[stability]} min={0} max={1} step={0.05} onValueChange={(v) => setStability(v[0])} />
              </div>
              <Button onClick={sendVoice} disabled={sending || !voiceText.trim() || !voiceId} size="sm" className="w-full">
                {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
                Generar y enviar nota de voz
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="media" className="p-3 space-y-2">
          <Select value={mediaKind} onValueChange={(v: any) => setMediaKind(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="photo"><ImageIcon className="w-3 h-3 mr-1 inline" /> Foto</SelectItem>
              <SelectItem value="document"><FileText className="w-3 h-3 mr-1 inline" /> Documento</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="URL pública del archivo"
          />
          <Input
            value={mediaCaption}
            onChange={(e) => setMediaCaption(e.target.value)}
            placeholder="Texto opcional"
          />
          <Button onClick={sendMedia} disabled={sending || !mediaUrl.trim()} size="sm" className="w-full">
            {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
            Enviar
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TelegramPanel;

function UnlinkedState({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("generate-telegram-link-token", {
      body: { lead_id: leadId },
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "No se pudo generar el link");
      return;
    }
    if (!data.enabled) {
      toast.error("Telegram no está activado en Settings → Lead System");
      return;
    }
    setLink(data.link);
    setExpiresAt(data.expires_at);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-center space-y-2">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <strong>{leadName}</strong> aún no ha vinculado Telegram. Genera un link de un solo uso y compártelo (por WhatsApp, SMS o email). Al abrirlo, Telegram registrará el <code>chat_id</code> automáticamente y este panel quedará activo.
        </p>
      </div>

      {!link ? (
        <Button onClick={generate} disabled={loading} className="w-full" size="sm">
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
          Generar link de vinculación
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={link} readOnly className="text-xs font-mono" />
            <Button onClick={copy} size="sm" variant="outline"><Copy className="w-3 h-3" /></Button>
          </div>
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block text-center">
            Abrir en Telegram ↗
          </a>
          {expiresAt && (
            <p className="text-[10px] text-muted-foreground text-center">
              Expira: {format(new Date(expiresAt), "dd/MM HH:mm")}
            </p>
          )}
          <Button onClick={generate} disabled={loading} variant="ghost" size="sm" className="w-full">
            <RefreshCw className="w-3 h-3 mr-1" /> Regenerar
          </Button>
        </div>
      )}
    </div>
  );
}

