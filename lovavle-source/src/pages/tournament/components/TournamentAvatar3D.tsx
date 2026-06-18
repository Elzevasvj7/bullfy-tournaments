import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import TournamentAvatar, { AvatarConfig, AvatarMood } from "./TournamentAvatar";
import { resolveAnimationUrl, AvatarAnimationKey, AvatarGender } from "./avatarAnimations";

interface Avatar3DProps {
  url: string;
  mood?: AvatarMood;
  animation?: AvatarAnimationKey | null;
  gender?: AvatarGender;
  fullBody?: boolean;
}

function HeadModel({ url, mood = "idle", animation, gender = "masculine", fullBody = false }: Avatar3DProps) {
  const group = useRef<THREE.Group>(null);
  const baseY = useRef(0);
  const measured = useRef<{ ok: boolean; lastY: number; stable: number }>({ ok: false, lastY: 0, stable: 0 });
  const { scene } = useGLTF(url);
  // useGLTF caches and returns the same Object3D for identical URLs. A Three.js
  // object can only have one parent, so using that cached scene in the lobby and
  // the poses preview at the same time makes one canvas steal it from the other.
  // SkeletonUtils.clone preserves skinned meshes/bones while giving every avatar
  // render its own mountable scene instance.
  const avatarScene = useMemo(() => cloneSkeleton(scene) as THREE.Group, [scene]);

  // Build the mixer once per cloned scene.
  const mixer = useMemo(() => new THREE.AnimationMixer(avatarScene), [avatarScene]);

  // Reset measurement flag whenever inputs change
  useEffect(() => {
    measured.current = { ok: false, lastY: 0, stable: 0 };
  }, [avatarScene, animation, fullBody, url]);

  // Bone pose tweaks + mesh setup (skip pose override while animation is active)
  useEffect(() => {
    avatarScene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
      if (animation) return;
      const bone = o as THREE.Bone;
      if (bone.isBone) {
        const n: string = (o.name || "").toLowerCase();
        if (n.includes("leftarm") && !n.includes("forearm")) {
          bone.rotation.z = -1.2;
        } else if (n.includes("rightarm") && !n.includes("forearm")) {
          bone.rotation.z = 1.2;
        } else if (n.includes("leftforearm")) {
          bone.rotation.y = -0.15;
          bone.rotation.z = -0.1;
        } else if (n.includes("rightforearm")) {
          bone.rotation.y = 0.15;
          bone.rotation.z = 0.1;
        }
      }
    });
  }, [avatarScene, animation]);

  const tryMeasure = () => {
    if (!group.current) return;
    // Reset transforms so the box reflects the raw scene
    group.current.scale.setScalar(1);
    group.current.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(avatarScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (!isFinite(size.y) || size.y < 0.5) return; // scene not ready
    // Wait until size is stable across 2 frames
    if (Math.abs(size.y - measured.current.lastY) > 0.01) {
      measured.current.lastY = size.y;
      measured.current.stable = 0;
      return;
    }
    measured.current.stable += 1;
    if (measured.current.stable < 2) return;

    if (fullBody) {
      const targetTotalHeight = 1.19;
      const s = targetTotalHeight / Math.max(size.y, 0.01);
      baseY.current = -(box.min.y + size.y / 2) * s;
      group.current.scale.setScalar(s);
      group.current.position.set(-center.x * s, baseY.current, -center.z * s);
    } else {
      const targetTotalHeight = 1.4;
      const s = targetTotalHeight / Math.max(size.y, 0.01);
      baseY.current = 0.18 - s * box.max.y;
      group.current.scale.setScalar(s);
      group.current.position.set(-center.x * s, baseY.current, -center.z * s);
    }
    measured.current.ok = true;
  };

  useFrame((_, dt) => {
    mixer.update(dt);
    if (!group.current) return;
    if (!measured.current.ok) {
      tryMeasure();
      if (!measured.current.ok) return;
    }
    const t = performance.now() / 1000;
    const intensity =
      mood === "celebrate" ? 1.6 : mood === "happy" ? 1.0 : mood === "ko" ? 2.2 : mood === "worried" ? 0.4 : 0.0;
    group.current.rotation.y = 0;
    if (fullBody) {
      // Lock the root every frame so animation root motion can't push the avatar
      // out of the rectangle. Keep centered (x=0, z=0) at baseY always.
      const bob = !animation && intensity > 0 ? Math.sin(t * 2.4) * 0.04 * intensity : 0;
      group.current.position.set(0, baseY.current + bob, 0);
    } else if (!animation) {
      group.current.position.y = baseY.current + (intensity > 0 ? Math.sin(t * 2.4) * 0.04 * intensity : 0);
    } else {
      // Lock the root so animation root motion doesn't push the face out of the chest-up frame.
      group.current.position.y = baseY.current;
    }
    if (mood === "ko") {
      group.current.rotation.z = Math.sin(t * 16) * 0.15;
    } else if (mood === "celebrate" && !animation) {
      group.current.rotation.z = Math.sin(t * 5) * 0.08;
    } else {
      group.current.rotation.z = 0;
    }
  });

  return (
    <group ref={group}>
      <primitive object={avatarScene} />
      {animation && (
        <ErrorBoundary key={`${animation}:${gender}`} onError={() => undefined}>
          <Suspense fallback={null}>
            <AnimationClipPlayer
              animation={animation}
              gender={gender}
              mixer={mixer}
              onStart={() => {
                measured.current = { ok: false, lastY: 0, stable: 0 };
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </group>
  );
}

function AnimationClipPlayer({
  animation,
  gender,
  mixer,
  onStart,
}: {
  animation: AvatarAnimationKey;
  gender: AvatarGender;
  mixer: THREE.AnimationMixer;
  onStart: () => void;
}) {
  const animGltf = useGLTF(resolveAnimationUrl(animation, gender));

  useEffect(() => {
    if (!animGltf?.animations?.length) return;
    const clip = animGltf.animations[0];
    const action = mixer.clipAction(clip);
    action.reset().fadeIn(0.2).play();
    onStart();
    return () => {
      action.fadeOut(0.2).stop();
    };
  }, [animGltf, mixer, onStart]);

  return null;
}

function Loader() {
  return (
    <Html center>
      <div className="text-xs text-muted-foreground animate-pulse">Cargando 3D…</div>
    </Html>
  );
}

interface Props {
  url?: string | null;
  fallbackConfig?: AvatarConfig | null;
  fallbackUrl?: string | null;
  fallbackSeed?: string;
  mood?: AvatarMood;
  /** Play a looped animation from the Bullfy library. Overrides static pose. */
  animation?: AvatarAnimationKey | null;
  /** Animation set to use. Defaults to masculine. */
  gender?: AvatarGender;
  /** Render full body (feet to head) instead of head-and-shoulders. */
  fullBody?: boolean;
  size?: number;
  /** Container shape. "circle" (default) renders a square rounded-full; "portrait" renders a 9:16 vertical rectangle ideal for full-body. */
  shape?: "circle" | "portrait";
  /** Optional explicit width — overrides size-derived width for portrait. */
  width?: number;
  /** Optional explicit height — overrides size-derived height for portrait. */
  height?: number;
  interactive?: boolean;
  className?: string;
}

function TournamentAvatar3DInner({
  url,
  fallbackConfig,
  fallbackUrl,
  fallbackSeed,
  mood = "idle",
  animation = null,
  gender = "masculine",
  fullBody = false,
  size = 220,
  shape = "circle",
  width,
  height,
  interactive = false,
  className = "",
}: Props) {
  const [failed, setFailed] = useState(false);
  // PR #8 — D7: capturamos el WebGLRenderer al crear el Canvas para poder
  // dispose() + forceContextLoss() en unmount. Sin esto el browser acumula
  // contextos WebGL (límite típico 8-16) y la navegación normal entre páginas
  // del módulo torneos los agota → avatar 3D del sidebar queda permanente en
  // "Cargando 3D…" y la consola se llena de THREE.WebGLRenderer: Context Lost.
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    return () => {
      const gl = rendererRef.current;
      if (gl) {
        try {
          gl.dispose();
          // forceContextLoss libera el slot WebGL para que el próximo Canvas
          // pueda obtener uno nuevo. Crucial cuando el componente se monta y
          // desmonta varias veces durante una sesión (navegación SPA).
          gl.forceContextLoss();
        } catch { /* ignore — ya disposed o context muerto */ }
        rendererRef.current = null;
      }
    };
  }, []);

  // If the source url or the active animation changes, give the canvas
  // another chance to render. Otherwise a transient GLB load error during
  // route changes would permanently hide the avatar until a full reload.
  useEffect(() => {
    setFailed(false);
  }, [url, animation, gender, fullBody]);

  const isPortrait = shape === "portrait";
  const w = width ?? (isPortrait ? Math.round(size * 0.62) : size);
  const h = height ?? size;
  const radiusClass = isPortrait ? "rounded-2xl" : "rounded-full";

  if (!url || failed) {
    return (
      <div style={{ width: w, height: h }} className={`${radiusClass} overflow-hidden ${className}`}>
        <TournamentAvatar
          config={fallbackConfig}
          fallbackUrl={fallbackUrl}
          fallbackSeed={fallbackSeed}
          mood={mood}
          size={Math.min(w, h)}
        />
      </div>
    );
  }

  const cameraPos: [number, number, number] = fullBody ? [0, 0, 2.6] : [0, 0.05, 0.85];
  const fov = fullBody ? 32 : 28;
  const renderKey = `${url}:${animation || "none"}:${gender}:${fullBody ? "body" : "head"}`;

  return (
    <div
      style={{ width: w, height: h }}
      className={`${radiusClass} overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background ${className}`}
    >
      <ErrorBoundary key={renderKey} onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: cameraPos, fov }}
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          onCreated={({ gl }) => { rendererRef.current = gl; }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 2]} intensity={1.1} />
          <Suspense fallback={<Loader />}>
            <HeadModel url={url} mood={mood} animation={animation} gender={gender} fullBody={fullBody} />
            <Environment preset="city" />
          </Suspense>
          {interactive && (
            <OrbitControls enablePan={false} enableZoom={false} target={[0, fullBody ? 0 : 0.05, 0]} />
          )}
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

import { memo } from "react";
const TournamentAvatar3D = memo(TournamentAvatar3DInner, (prev, next) => {
  return (
    prev.url === next.url &&
    prev.mood === next.mood &&
    prev.animation === next.animation &&
    prev.gender === next.gender &&
    prev.fullBody === next.fullBody &&
    prev.size === next.size &&
    prev.shape === next.shape &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.interactive === next.interactive &&
    prev.className === next.className
  );
});
export default TournamentAvatar3D;

import React from "react";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
