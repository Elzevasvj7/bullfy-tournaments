import { useEffect, useState } from "react";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import TournamentAvatar3D from "./TournamentAvatar3D";
import { AVATAR_ANIMATIONS, type AvatarAnimationKey } from "./avatarAnimations";

/**
 * Avatar badge anchored top-left, just below the "TOURNAMENT" wordmark.
 * Rectangular portrait container with transparent background so the
 * tournament video plays through behind the 3D avatar.
 *
 * If the user has chosen a preferred pose, we honor it. Otherwise we
 * cycle through a set of lively idle/expression animations so the
 * avatar never feels static in the lobby.
 */
const LOBBY_ROTATION: AvatarAnimationKey[] = [
  "weight_shift",
  "wave",
  "crossed_arms",
  "thinking",
  "clapping",
];

export default function TournamentAvatarOverlay() {
  const { user } = useTournamentAuth();
  const [rotIdx, setRotIdx] = useState(0);

  const url = user?.avatar_3d_url;
  const hasCustomPose =
    !!user?.preferred_pose &&
    user.preferred_pose !== "idle" &&
    user.preferred_pose in AVATAR_ANIMATIONS.masculine;

  useEffect(() => {
    if (hasCustomPose) return;
    const id = setInterval(() => {
      setRotIdx((i) => (i + 1) % LOBBY_ROTATION.length);
    }, 7000);
    return () => clearInterval(id);
  }, [hasCustomPose]);

  if (!user || !url) return null;

  const poseKey: AvatarAnimationKey = hasCustomPose
    ? (user.preferred_pose as AvatarAnimationKey)
    : LOBBY_ROTATION[rotIdx];

  return (
    <div className="fixed top-[120px] left-6 z-30 pointer-events-none">
      <div
        className="rounded-2xl ring-2 ring-[#00E5FF]/60
                   shadow-[0_0_24px_rgba(0,229,255,0.45)] overflow-hidden"
        aria-hidden
      >
        <TournamentAvatar3D
          url={url}
          fallbackConfig={(user as any).avatar_config || null}
          fallbackSeed={user.username || user.full_name}
          mood="idle"
          animation={poseKey}
          gender={((user as any).avatar_config?.gender as any) || "masculine"}
          fullBody={true}
          shape="portrait"
          size={220}
          className="!bg-transparent bg-none [background-image:none]"
        />
      </div>
    </div>
  );
}
