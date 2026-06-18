import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  POSE_CATALOG,
  FREE_POSE_KEYS,
  type PoseCatalogItem,
  type AvatarAnimationKey,
} from "./components/avatarAnimations";
import TournamentAvatar3D from "./components/TournamentAvatar3D";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Coins, Sparkles } from "lucide-react";

/**
 * IMPORTANT: We render a SINGLE 3D Canvas for the preview at the top of the
 * page and keep the catalog cards lightweight (no Canvas per card).
 *
 * Mounting 12 <Canvas> instances simultaneously exhausts the browser's
 * WebGL context limit (~8–16), which silently kills older contexts —
 * making the lobby avatar disappear and most cards render blank.
 */
export default function TournamentPoses() {
  const { user, unlockedPoses, refresh, token } = useTournamentAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<AvatarAnimationKey>(
    ((user?.preferred_pose as AvatarAnimationKey) || "idle"),
  );

  const gender = ((user as any)?.avatar_config?.gender as any) || "masculine";

  const ownedSet = useMemo(() => {
    const s = new Set<string>(FREE_POSE_KEYS);
    (unlockedPoses || []).forEach((k) => s.add(k));
    return s;
  }, [unlockedPoses]);

  const mine = POSE_CATALOG.filter((p) => ownedSet.has(p.key));
  const store = POSE_CATALOG.filter((p) => !ownedSet.has(p.key));
  const currentPose = POSE_CATALOG.find((p) => p.key === previewKey);

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-300">
        Inicia sesión para gestionar tus poses.
      </div>
    );
  }

  if (!user.avatar_3d_url) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <h1 className="t-display text-3xl font-black text-white">Crea tu avatar primero</h1>
        <p className="text-gray-400">Para elegir poses necesitas un avatar 3D.</p>
        <Button onClick={() => navigate("/tournament/avatar")} className="bg-[#00E5FF] text-[#060B1F]">
          Crear avatar
        </Button>
      </div>
    );
  }

  async function callPoseAction(action: "equip" | "unlock", poseKey: string) {
    if (!token) return;
    setBusy(poseKey);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-pose-action", {
        body: { action, pose_key: poseKey },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({
        title: action === "equip" ? "Pose equipada" : "Pose desbloqueada",
        description: action === "unlock" ? `Saldo: ${data.balance} BP` : undefined,
      });
      await refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const renderCard = (p: PoseCatalogItem) => {
    const owned = ownedSet.has(p.key);
    const equipped = user.preferred_pose === p.key;
    const insufficientBp = !owned && p.cost > 0 && (user.bullfy_points || 0) < p.cost;
    const isPreviewing = previewKey === p.key;

    return (
      <Card
        key={p.key}
        className={`relative overflow-hidden bg-[#0a1129]/80 transition-all p-4 flex flex-col ${
          isPreviewing
            ? "border-[#00E5FF] ring-2 ring-[#00E5FF]/40"
            : "border-white/10 hover:border-[#00E5FF]/40"
        }`}
      >
        {equipped && (
          <Badge className="absolute top-2 right-2 z-10 bg-[#B6FF3D] text-[#060B1F] border-0 font-black">
            <Check className="h-3 w-3 mr-1" /> Equipada
          </Badge>
        )}
        {/* Static thumbnail image — no <Canvas> per card */}
        <button
          type="button"
          onClick={() => setPreviewKey(p.key)}
          className="relative rounded-xl overflow-hidden mb-3 aspect-[3/4] w-full
                     bg-gradient-to-b from-[#062B63]/50 via-[#0a1129] to-[#060B1F]
                     border border-white/5 hover:border-[#00E5FF]/40 group"
          aria-label={`Previsualizar ${p.label}`}
        >
          <img
            src={p.thumbnail}
            alt={p.label}
            loading="lazy"
            width={512}
            height={704}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-widest text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
            {p.category}
          </span>
        </button>
        <h3 className="t-display font-black text-white text-base">{p.label}</h3>
        <p className="text-xs text-gray-400 mb-3">{p.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-[#00E5FF] hover:text-white hover:bg-[#00E5FF]/10"
            onClick={() => setPreviewKey(p.key)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Probar
          </Button>
          {owned ? (
            <Button
              size="sm"
              disabled={equipped || busy === p.key}
              onClick={() => callPoseAction("equip", p.key)}
              className="bg-[#00E5FF] text-[#060B1F] font-black hover:brightness-110"
            >
              {equipped ? "Equipada" : "Equipar"}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={insufficientBp || busy === p.key}
              onClick={() => callPoseAction("unlock", p.key)}
              className="bg-gradient-to-r from-[#B6FF3D] to-[#00E5FF] text-[#060B1F] font-black"
            >
              {insufficientBp ? <><Lock className="h-3 w-3 mr-1" />{p.cost} BP</> : <><Coins className="h-3 w-3 mr-1" />{p.cost} BP</>}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-black text-[#00E5FF] uppercase tracking-[0.4em] mb-1">Avatar</p>
          <h1 className="t-display text-4xl font-black text-white">Poses & Bailes</h1>
          <p className="text-sm text-gray-400 mt-2">
            Elige cómo se ve tu avatar en el lobby y tu perfil. Desbloquea bailes con Bullfy Points.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-[#0a1129] border border-[#B6FF3D]/30 text-[#B6FF3D] font-black flex items-center gap-2">
          <Coins className="h-4 w-4" />
          {(user.bullfy_points || 0).toLocaleString()} BP
        </div>
      </div>

      {/* Single shared preview canvas */}
      <Card className="bg-gradient-to-br from-[#062B63]/40 via-[#0a1129] to-[#060B1F] border-[#00E5FF]/30 p-6 flex flex-col md:flex-row items-center gap-6">
        <div
          className="rounded-2xl overflow-hidden ring-2 ring-[#00E5FF]/40 shadow-[0_0_32px_rgba(0,229,255,0.35)] shrink-0"
          style={{ width: 220, height: 360 }}
        >
          <TournamentAvatar3D
            url={user.avatar_3d_url!}
            fallbackConfig={(user as any).avatar_config}
            fallbackSeed={user.username || user.full_name}
            mood="idle"
            animation={previewKey}
            gender={gender}
            fullBody
            shape="portrait"
            width={220}
            height={360}
            interactive
          />
        </div>
        <div className="flex-1 text-center md:text-left">
          <p className="text-[10px] font-black text-[#00E5FF] uppercase tracking-[0.4em] mb-1">Previsualización</p>
          <h2 className="t-display text-3xl font-black text-white">{currentPose?.label ?? "Reposo"}</h2>
          <p className="text-sm text-gray-400 mt-2">{currentPose?.description}</p>
          {currentPose && ownedSet.has(currentPose.key) && user.preferred_pose !== currentPose.key && (
            <Button
              onClick={() => callPoseAction("equip", currentPose.key)}
              disabled={busy === currentPose.key}
              className="mt-4 bg-[#00E5FF] text-[#060B1F] font-black hover:brightness-110"
            >
              <Check className="h-4 w-4 mr-2" /> Equipar esta pose
            </Button>
          )}
        </div>
      </Card>

      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Mis poses</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mine.map(renderCard)}
        </div>
      </section>

      {store.length > 0 && (
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Tienda · canjea con BP</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {store.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
