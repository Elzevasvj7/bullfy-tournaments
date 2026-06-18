import { useMemo } from "react";
import { motion } from "framer-motion";
import { createAvatar } from "@dicebear/core";
import {
  avataaars,
  adventurer,
  bottts,
  funEmoji,
  lorelei,
  micah,
  notionists,
  pixelArt,
} from "@dicebear/collection";

export const AVATAR_STYLES = {
  avataaars,
  adventurer,
  bottts,
  funEmoji,
  lorelei,
  micah,
  notionists,
  pixelArt,
} as const;

export type AvatarStyleKey = keyof typeof AVATAR_STYLES;

export interface AvatarConfig {
  style?: AvatarStyleKey;
  seed?: string;
  backgroundColor?: string[];
  /**
   * Optional face photo (data URL or http URL) that overlays the avatar's
   * face area. When set, the user's real face is composited on top of the
   * stylized avatar — Ready Player One vibe.
   */
  face_photo_url?: string | null;
   /** Persisted Avaturn user id so the player can edit their existing avatar across sessions. */
  avaturn_user_id?: string | null;
  avaturn_avatar_id?: string | null;
  /** Drives which animation set (masculine/feminine) is used in lobby/podium. */
  gender?: "masculine" | "feminine" | null;
   // Forwarded to the underlying DiceBear style. Free-form per style.
   options?: Record<string, unknown>;
}

export type AvatarMood = "idle" | "happy" | "worried" | "celebrate" | "ko";

const MOOD_VARIANTS: Record<AvatarMood, any> = {
  idle: { y: [0, -1.5, 0], rotate: 0, scale: 1 },
  happy: { y: [0, -4, 0], rotate: [0, -3, 3, 0], scale: 1.02 },
  worried: { y: [0, 1.5, 0], rotate: [0, -1.5, 1.5, 0], scale: 0.99 },
  celebrate: { y: [0, -10, 0], rotate: [-8, 8, -8], scale: 1.06 },
  ko: { y: [0, 2, 0], rotate: [0, -12, 12, 0], scale: 0.95 },
};

const MOOD_DURATION: Record<AvatarMood, number> = {
  idle: 3.4,
  happy: 1.6,
  worried: 2.0,
  celebrate: 0.9,
  ko: 0.4,
};

export function buildAvatarDataUri(config?: AvatarConfig | null, fallbackSeed?: string): string | null {
  const styleKey = (config?.style && AVATAR_STYLES[config.style]) ? config.style : "avataaars";
  const seed = config?.seed || fallbackSeed || "bullfy";
  try {
    const style = AVATAR_STYLES[styleKey] as any;
    const a = createAvatar(style, {
      seed,
      backgroundColor: config?.backgroundColor,
      ...(config?.options || {}),
    });
    return a.toDataUri();
  } catch {
    return null;
  }
}

interface Props {
  config?: AvatarConfig | null;
  fallbackUrl?: string | null;
  fallbackSeed?: string;
  mood?: AvatarMood;
  size?: number;
  className?: string;
  alt?: string;
  /** Override face overlay (otherwise pulled from config.face_photo_url). Pass null to disable. */
  faceOverlayUrl?: string | null;
}

export default function TournamentAvatar({
  config,
  fallbackUrl,
  fallbackSeed,
  mood = "idle",
  size = 48,
  className = "",
  alt = "",
  faceOverlayUrl,
}: Props) {
  const dataUri = useMemo(
    () => buildAvatarDataUri(config, fallbackSeed),
    [config, fallbackSeed],
  );
  const src = dataUri || fallbackUrl || null;
  const faceSrc =
    faceOverlayUrl !== undefined ? faceOverlayUrl : (config?.face_photo_url || null);

  return (
    <motion.div
      className={`relative rounded-full overflow-hidden bg-muted flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      animate={MOOD_VARIANTS[mood]}
      transition={{
        repeat: Infinity,
        repeatType: "loop",
        duration: MOOD_DURATION[mood],
        ease: "easeInOut",
      }}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span className="text-xs font-bold text-foreground">
          {(fallbackSeed || "?").charAt(0).toUpperCase()}
        </span>
      )}
      {faceSrc && (
        <img
          src={faceSrc}
          alt=""
          draggable={false}
          className="absolute rounded-full object-cover shadow-[0_0_0_2px_rgba(0,0,0,0.4)]"
          style={{
            width: size * 0.62,
            height: size * 0.62,
            top: size * 0.10,
            left: "50%",
            transform: "translateX(-50%)",
            // Soft feather so the face blends into the avatar head
            WebkitMaskImage:
              "radial-gradient(circle at center, #000 55%, transparent 78%)",
            maskImage:
              "radial-gradient(circle at center, #000 55%, transparent 78%)",
          }}
        />
      )}
    </motion.div>
  );
}
