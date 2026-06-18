import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import TournamentAvatar, { AVATAR_STYLES, AvatarConfig, AvatarMood, AvatarStyleKey } from "./components/TournamentAvatar";
import TournamentAvatar3D from "./components/TournamentAvatar3D";
import { AvaturnSDK } from "@avaturn/sdk";
import { Dice5, Save, Sparkles, Smile, Frown, PartyPopper, Skull, Box, Trash2, ExternalLink, Upload, User, Wand2 } from "lucide-react";

const avatarCacheKey = (userId: string) => `tournament_avatar_3d_url:${userId}`;
const cacheAvatar3D = (userId: string, url?: string | null) => {
  if (!url || url.length > 2_000_000) return;
  try { localStorage.setItem(avatarCacheKey(userId), url); } catch { /* dataURL may exceed quota */ }
};

const normalizeAvatarExportUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s/g, "");
};

const findAvatarExportString = (payload: any): string => {
  const candidates = [
    payload?.url,
    payload?.export_url,
    payload?.avatar_url,
    payload?.avatar?.url,
    payload?.avatar?.export_url,
    payload?.data?.url,
    payload?.data?.export_url,
    payload?.data?.avatar_url,
  ].map(normalizeAvatarExportUrl).filter(Boolean);

  return candidates.find((url) => /^(https?:\/\/|data:(model\/gltf-binary|application\/octet-stream);base64,)/i.test(url)) || "";
};

/** Resize a user-selected image to a square data URL (JPEG) for compact storage in avatar_config. */
async function fileToFaceDataUrl(file: File, size = 256): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Crop center square
  const src = Math.min(img.width, img.height);
  const sx = (img.width - src) / 2;
  const sy = (img.height - src) / 2;
  ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

const STYLE_LABELS: Record<AvatarStyleKey, string> = {
  avataaars: "Avataaars",
  adventurer: "Adventurer",
  bottts: "Robot",
  funEmoji: "Emoji Fun",
  lorelei: "Lorelei",
  micah: "Micah",
  notionists: "Notion",
  pixelArt: "Pixel Art",
};

const PALETTES = [
  ["146EF5"],
  ["062B63"],
  ["FFD56B"],
  ["F472B6"],
  ["10B981"],
  ["EF4444"],
  ["A855F7"],
  ["transparent"],
];

const MOODS: { id: AvatarMood; icon: any; label: string }[] = [
  { id: "idle", icon: Sparkles, label: "Idle" },
  { id: "happy", icon: Smile, label: "Feliz" },
  { id: "worried", icon: Frown, label: "Nervios" },
  { id: "celebrate", icon: PartyPopper, label: "Celebra" },
  { id: "ko", icon: Skull, label: "K.O." },
];

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TournamentAvatarStudio() {
  const { user, token, loading, refresh } = useTournamentAuth();
  const nav = useNavigate();
  const [config, setConfig] = useState<AvatarConfig>({ style: "avataaars", seed: "bullfy" });
  const [avatar3dUrl, setAvatar3dUrl] = useState<string>("");
  const [preview, setPreview] = useState<AvatarMood>("idle");
  const [previewAnim, setPreviewAnim] = useState<"idle" | "victory" | "thinking" | null>(null);
  const [view3D, setView3D] = useState(false);
  const [rpmOpen, setRpmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && (user as any).avatar_config) {
      setConfig((user as any).avatar_config as AvatarConfig);
    } else if (user) {
      setConfig({ style: "avataaars", seed: user.username || user.id });
    }
    if (user && (user as any).avatar_3d_url) {
      setAvatar3dUrl((user as any).avatar_3d_url as string);
      setView3D(true);
    }
  }, [user]);

  // Avaturn Pro: lazy-load session URL and mount SDK when the tab opens.
  const avaturnContainerRef = useRef<HTMLDivElement | null>(null);
  const avaturnSdkRef = useRef<AvaturnSDK | null>(null);
  const [avaturnLoading, setAvaturnLoading] = useState(false);
  const [avaturnError, setAvaturnError] = useState<string | null>(null);
  const [avaturnMounted, setAvaturnMounted] = useState(false);

  const launchAvaturn = async () => {
    if (avaturnMounted || avaturnLoading) return;
    setAvaturnLoading(true);
    setAvaturnError(null);
    try {
      const { data, error } = await supabase.functions.invoke("avaturn-session", {
        body: {
          avaturn_user_id: config.avaturn_user_id || null,
          avaturn_avatar_id: config.avaturn_avatar_id || null,
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "No se pudo iniciar Bullfy Avatar");
      const sessionUrl: string = data.url;
      const avaturnUserId: string = data.avaturn_user_id;
      setConfig((c) => ({ ...c, avaturn_user_id: avaturnUserId }));

      const container = avaturnContainerRef.current;
      if (!container) throw new Error("Container no listo");
      const sdk = new AvaturnSDK();
      avaturnSdkRef.current = sdk;
      await sdk.init(container, { url: sessionUrl, iframeClassName: "avaturn-iframe" });
      sdk.on("export", (payload: any) => {
        // Depending on the Avaturn export setting this can be httpURL or dataURL.
        const glb = findAvatarExportString(payload);
        const avatarId =
          payload?.avatarId ||
          payload?.avatar_id ||
          payload?.avatar?.avatarId ||
          payload?.avatar?.id ||
          payload?.data?.avatarId ||
          payload?.data?.avatar_id ||
          payload?.id;
        if (glb) {
          setAvatar3dUrl(glb);
          setView3D(true);
          // Auto-detect gender from Avaturn payload (used to pick animation set).
          const rawGender = (
            payload?.gender ||
            payload?.avatar?.gender ||
            payload?.data?.gender ||
            payload?.body_type ||
            ""
          ).toString().toLowerCase();
          const detected: "masculine" | "feminine" | null =
            rawGender.includes("female") || rawGender.includes("fem") || rawGender === "f"
              ? "feminine"
              : rawGender.includes("male") || rawGender === "m"
              ? "masculine"
              : null;
          // Fija el avatar_id la primera vez: futuras sesiones serán edit-only (ropa/accesorios).
          setConfig((c) => ({
            ...c,
            avaturn_avatar_id: c.avaturn_avatar_id || avatarId || null,
            gender: c.gender || detected || c.gender,
          }));
          toast.success("Bullfy Avatar listo. Recuerda guardar.");
        } else {
          toast.error("Bullfy Avatar no devolvió una URL");
          console.error("Avaturn export payload sin url", payload);
        }
      });
      setAvaturnMounted(true);
    } catch (e: any) {
      setAvaturnError(e.message || "Error iniciando Bullfy Avatar");
      toast.error(e.message || "Error iniciando Bullfy Avatar");
    } finally {
      setAvaturnLoading(false);
    }
  };

  // Cleanup the Avaturn SDK iframe when the studio unmounts to avoid memory leaks.
  useEffect(() => {
    return () => {
      try {
        avaturnSdkRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      avaturnSdkRef.current = null;
    };
  }, []);


  // Listen for Ready Player Me avatar export events
  useEffect(() => {
    if (!rpmOpen) return;
    const onMsg = (e: MessageEvent) => {
      const raw = e.data;
      let parsed: any = raw;
      if (typeof raw === "string") {
        try { parsed = JSON.parse(raw); } catch { return; }
      }
      if (parsed?.source !== "readyplayerme") return;
      if (parsed.eventName === "v1.avatar.exported" && parsed.data?.url) {
        setAvatar3dUrl(parsed.data.url);
        setRpmOpen(false);
        setView3D(true);
        toast.success("Avatar 3D listo. Recuerda guardar.");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [rpmOpen]);

  const styleKeys = useMemo(() => Object.keys(AVATAR_STYLES) as AvatarStyleKey[], []);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-profile-update", {
        body: { avatar_config: config, avatar_3d_url: avatar3dUrl || null },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Error guardando");
      if (user?.id && (data.user?.avatar_3d_url || avatar3dUrl)) {
        cacheAvatar3D(user.id, data.user?.avatar_3d_url || avatar3dUrl);
      }
      toast.success("Avatar guardado");
      await refresh();
      nav("/tournament/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground p-8">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tu Avatar</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza tu identidad en el torneo. Lo verán en la tabla En Vivo, el podio y tu perfil público.
        </p>
      </div>

      <div className="grid md:grid-cols-[360px_1fr] gap-6">
        {/* Preview */}
        <Card className="md:sticky md:top-4 md:self-start">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Vista previa</CardTitle>
            {avatar3dUrl && (
              <Button
                size="sm"
                variant={view3D ? "default" : "outline"}
                onClick={() => setView3D((v) => !v)}
                className="h-7 px-2"
              >
                <Box className="h-3 w-3 mr-1" />{view3D ? "3D" : "2D"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {view3D && avatar3dUrl ? (
              <TournamentAvatar3D
                url={avatar3dUrl}
                fallbackConfig={config}
                fallbackSeed={user.username || user.full_name}
                mood={preview}
                gender={(config.gender as any) || "masculine"}
                animation={previewAnim}
                fullBody
                shape="portrait"
                width={320}
                height={520}
                interactive
                className="ring-4 ring-primary/30 shadow-xl"
              />
            ) : (
              <TournamentAvatar
                config={config}
                fallbackSeed={user.username || user.full_name}
                mood={preview}
                size={200}
                className="ring-4 ring-primary/30 shadow-xl"
              />
            )}


            {view3D && avatar3dUrl && (
              <div className="w-full space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Género (animaciones)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["masculine", "feminine"] as const).map((g) => (
                    <Button
                      key={g}
                      size="sm"
                      variant={(config.gender || "masculine") === g ? "default" : "outline"}
                      className="h-8"
                      onClick={() => setConfig((c) => ({ ...c, gender: g }))}
                    >
                      {g === "masculine" ? "Masculino" : "Femenino"}
                    </Button>
                  ))}
                </div>

                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground pt-2">Probar animación</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([null, "idle", "thinking", "victory"] as const).map((a) => (
                    <Button
                      key={a || "static"}
                      size="sm"
                      variant={previewAnim === a ? "default" : "outline"}
                      className="h-7 text-[11px] px-2"
                      onClick={() => setPreviewAnim(a)}
                    >
                      {a === null ? "Pose" : a}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />{saving ? "Guardando..." : "Guardar avatar"}
            </Button>
          </CardContent>
        </Card>

        {/* Editor — sólo Bullfy Avatar por ahora */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Bullfy Avatar (3D realista)
            </Label>
            <p className="text-xs text-muted-foreground">
              Crea un avatar 3D realista desde una selfie.
              Se mostrará en el podio del torneo y en tu perfil público.
            </p>
            {!avaturnMounted && (
              <Button onClick={launchAvaturn} disabled={avaturnLoading} size="sm">
                <Wand2 className="h-4 w-4 mr-2" />
                {avaturnLoading ? "Iniciando…" : (config.avaturn_user_id ? "Editar mi Bullfy Avatar" : "Crear Bullfy Avatar")}
              </Button>
            )}
            {avaturnError && (
              <p className="text-xs text-destructive">{avaturnError}</p>
            )}
            <div
              className="relative w-full rounded-xl overflow-hidden bg-muted/20 border border-border"
              style={{ height: avaturnMounted ? "min(70vh, 700px)" : 0 }}
            >
              <div
                ref={avaturnContainerRef}
                className="w-full h-full"
              />
              {avaturnMounted && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end pl-4 pb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Bullfy Avatar</span>
                </div>
              )}
            </div>
            {avatar3dUrl && (
              <p className="text-[11px] text-muted-foreground">
                Avatar 3D guardado en memoria. No olvides pulsar <strong>Guardar avatar</strong>.
              </p>
            )}
            {avatar3dUrl && (
              <Button onClick={() => { setAvatar3dUrl(""); setView3D(false); }} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />Quitar Bullfy Avatar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ready Player Me iframe modal */}
      {rpmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setRpmOpen(false)}
        >
          <div
            className="bg-background rounded-2xl overflow-hidden shadow-2xl w-full max-w-4xl flex flex-col"
            style={{ height: "min(80vh, 800px)", maxHeight: "calc(100dvh - 2rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <div className="text-sm font-semibold">Diseña tu avatar 3D</div>
              <div className="flex items-center gap-2">
                <a
                  href="https://bullfy.readyplayer.me/avatar?frameApi&clearCache"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />Abrir en nueva pestaña
                </a>
                <Button variant="ghost" size="sm" onClick={() => setRpmOpen(false)}>Cerrar</Button>
              </div>
            </div>
            <div className="relative flex-1 w-full bg-muted/20">
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
                Cargando editor de avatar 3D…
              </div>
              <iframe
                title="Ready Player Me"
                src="https://bullfy.readyplayer.me/avatar?frameApi&clearCache"
                allow="camera *; microphone *; clipboard-write; accelerometer; gyroscope"
                allowFullScreen
                className="relative w-full h-full border-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center p-2 shrink-0 sm:hidden">
              ¿No carga? Toca "Abrir en nueva pestaña" arriba.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
