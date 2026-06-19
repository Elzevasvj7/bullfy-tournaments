"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AvaturnSDK, type ExportAvatarResult } from "@avaturn/sdk";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvatarProfile } from "../types";

type AvatarStudioProps = {
  initialProfile: AvatarProfile;
  initials: string;
};

type StudioState = "idle" | "launching" | "ready" | "saving" | "saved" | "error";

const READY_PLAYER_ME_IDLE_ANIMATION_URL =
  "https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master/masculine/glb/idle/M_Standing_Idle_001.glb";
const AVATAR_PREVIEW_HEIGHT = 2.85;
const AVATAR_PREVIEW_FOOT_Y = -1.38;

export function AvatarStudio({ initialProfile, initials }: AvatarStudioProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sdkRef = useRef<AvaturnSDK | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [editorOpen, setEditorOpen] = useState(false);
  const [status, setStatus] = useState<StudioState>("idle");
  const [message, setMessage] = useState(
    profile.avatarUrl
      ? "Avatar 3D disponible para perfil, podio y ArenaTV."
      : "Inicia el editor para crear tu Bullfy Avatar.",
  );

  const hasAvatar = Boolean(profile.avatarUrl);
  const isBusy = status === "launching" || status === "saving";

  function destroyAvaturnEditor() {
    sdkRef.current?.destroy();
    sdkRef.current = null;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }

  useEffect(() => {
    return () => {
      destroyAvaturnEditor();
    };
  }, []);

  async function launchAvaturn() {
    if (isBusy || editorOpen) {
      return;
    }

    setEditorOpen(true);
    setStatus("launching");
    setMessage("Creando sesion segura con Avaturn.");

    try {
      const response = await fetch("/api/profile/avatar/session", {
        method: "POST",
      });
      const data = (await response.json()) as {
        avaturnUserId?: string;
        error?: string;
        ok?: boolean;
        sessionUrl?: string;
      };

      if (!response.ok || !data.ok || !data.sessionUrl) {
        throw new Error(data.error || "No se pudo iniciar Avaturn.");
      }

      const container = containerRef.current;

      if (!container) {
        throw new Error("El contenedor del editor no esta listo.");
      }

      destroyAvaturnEditor();
      container.innerHTML = "";

      const sdk = new AvaturnSDK();
      sdkRef.current = sdk;

      await sdk.init(container, {
        iframeClassName: "avaturn-iframe",
        url: data.sessionUrl,
      });
      fitAvaturnIframe(container);

      sdk.on("load", () => {
        fitAvaturnIframe(container);
        setStatus("ready");
        setMessage("Editor listo. Completa el flujo y exporta el avatar.");
      });
      sdk.on("error", (error) => {
        setStatus("error");
        setMessage(error.message || "Avaturn reporto un error.");
      });
      sdk.on("export", (payload) => {
        void saveExport(payload);
      });
      setProfile((current) => ({
        ...current,
        avaturnUserId: data.avaturnUserId ?? current.avaturnUserId,
      }));
      setStatus("ready");
      setMessage("Editor cargado. Al finalizar, Avaturn enviara el export.");
    } catch (error) {
      setEditorOpen(false);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar Bullfy Avatar.",
      );
    }
  }

  async function saveExport(payload: ExportAvatarResult) {
    const url = findAvatarExportString(payload);

    if (!url) {
      setStatus("error");
      setMessage("Avaturn no devolvio una URL GLB valida.");
      return;
    }

    setStatus("saving");
    setMessage(
      payload.urlType === "dataURL"
        ? "Subiendo GLB a Supabase Storage."
        : "Guardando referencia del avatar exportado.",
    );

    try {
      const response = await fetch("/api/profile/avatar", {
        body: JSON.stringify({
          avatarId: payload.avatarId,
          bodyId: payload.bodyId,
          gender: payload.gender,
          rawPayload: createSafePayload(payload),
          sessionId: payload.sessionId,
          url,
          urlType: payload.urlType,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        profile?: AvatarProfile;
      };

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error || "No se pudo guardar el avatar.");
      }

      setProfile(data.profile);
      setEditorOpen(false);
      destroyAvaturnEditor();
      setStatus("saved");
      setMessage("Avatar guardado en la base de datos.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar avatar.",
      );
    }
  }

  function closeEditor() {
    setEditorOpen(false);
    destroyAvaturnEditor();
    setStatus(profile.avatarUrl ? "saved" : "idle");
    setMessage(
      profile.avatarUrl
        ? "Avatar 3D disponible para perfil, podio y ArenaTV."
        : "Inicia el editor para crear tu Bullfy Avatar.",
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
      <section className="relative overflow-hidden rounded-lg border border-bullfy-neon-blue/20 bg-bullfy-panel/82 p-5 shadow-glass-blue backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-bullfy-neon-blue/70" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
              Avatar Studio
            </Badge>
            <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none tracking-normal sm:text-6xl">
              Crea tu identidad 3D
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Sesion real de Avaturn montada en Bullfy. El QR y el flujo de
              fotos viven dentro del editor; nosotros guardamos el resultado en
              la DB cuando Avaturn exporta el avatar.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            disabled={isBusy || editorOpen}
            onClick={launchAvaturn}
            size="lg"
            variant="neonBlueSolid"
          >
            {status === "launching" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editorOpen ? (
              <CheckCircle2 className="size-4" />
            ) : hasAvatar ? (
              <RefreshCw className="size-4" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {editorOpen
              ? "Editor activo"
              : hasAvatar
                ? "Editar avatar"
                : "Crear Bullfy Avatar"}
          </Button>
          {editorOpen ? (
            <Button
              disabled={status === "saving"}
              onClick={closeEditor}
              size="lg"
              variant="outline"
            >
              <X className="size-4" />
              Cerrar editor
            </Button>
          ) : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-black/35">
          <div
            className={cn(
              "avaturn-sdk-shell relative min-h-[30rem] transition-[height] duration-300",
              editorOpen ? "h-[min(78vh,820px)]" : "h-[34rem]",
            )}
          >
            <div
              ref={containerRef}
              className={cn(
                "avaturn-sdk-host relative z-10 h-full min-h-[30rem] w-full",
                !editorOpen && "hidden",
              )}
            />

            {!editorOpen && hasAvatar && profile.avatarUrl ? (
              <AvatarPreview url={profile.avatarUrl} />
            ) : null}

            {!editorOpen && !hasAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto flex size-28 items-center justify-center rounded-lg border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/10 text-4xl font-black text-bullfy-neon-blue shadow-neon-blue">
                    {initials}
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-slate-300">
                    Bullfy Avatar
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {message}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function AvatarPreview({ url }: { url: string }) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    return () => {
      const renderer = rendererRef.current;

      if (!renderer) {
        return;
      }

      renderer.dispose();
      renderer.forceContextLoss();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ far: 50, fov: 30, near: 0.1, position: [0.52, 0.18, 6.45] }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
        }}
        style={{ pointerEvents: "none" }}
      >
        <AvatarPreviewCamera />
        <color attach="background" args={["#020713"]} />
        <hemisphereLight
          args={["#d7f7ff", "#07111c", 1.35]}
          position={[0, 3, 0]}
        />
        <directionalLight intensity={2.1} position={[2.5, 4.5, 4]} />
        <directionalLight intensity={0.9} position={[-3, 2.2, -2]} />
        <pointLight color="#00e5ff" intensity={1.1} position={[-1.9, 1.2, 2]} />
        <Suspense
          fallback={
            <Html center>
              <div className="rounded-lg border border-white/10 bg-black/70 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                Cargando avatar
              </div>
            </Html>
          }
        >
          <AvatarModel url={url} />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020713] to-transparent" />
      <div className="pointer-events-none absolute left-5 top-5 rounded-lg border border-bullfy-neon-green/25 bg-bullfy-neon-green/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-bullfy-neon-green">
        Avatar activo
      </div>
    </div>
  );
}

function AvatarPreviewCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0.52, 0.18, 6.45);
    camera.lookAt(0, 0.05, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function AvatarModel({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const { avatarScene, modelScale } = useMemo(() => {
    const clonedScene = cloneSkeleton(scene) as THREE.Group;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 1);

    clonedScene.position.set(-center.x, -box.min.y, -center.z);

    return {
      avatarScene: clonedScene,
      modelScale: AVATAR_PREVIEW_HEIGHT / height,
    };
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(avatarScene), [avatarScene]);

  useEffect(() => {
    avatarScene.traverse((object) => {
      if (isMesh(object)) {
        object.castShadow = false;
        object.receiveShadow = false;
        object.frustumCulled = false;
        tuneMaterial(object.material);
      }
    });
  }, [avatarScene]);

  useFrame(({ clock }, delta) => {
    mixer.update(delta);

    const group = groupRef.current;

    if (!group) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    group.rotation.y = -0.2 + Math.sin(elapsed * 0.7) * 0.025;
    group.position.y = AVATAR_PREVIEW_FOOT_Y + Math.sin(elapsed * 1.4) * 0.008;
  });

  return (
    <group ref={groupRef} scale={modelScale} position={[0, AVATAR_PREVIEW_FOOT_Y, 0]}>
      <primitive object={avatarScene} />
      <AvatarAnimationBoundary>
        <Suspense fallback={null}>
          <AvatarIdleAnimation mixer={mixer} />
        </Suspense>
      </AvatarAnimationBoundary>
    </group>
  );
}

function AvatarIdleAnimation({ mixer }: { mixer: THREE.AnimationMixer }) {
  const { animations } = useGLTF(READY_PLAYER_ME_IDLE_ANIMATION_URL);

  useEffect(() => {
    const clip = animations[0];

    if (!clip) {
      return;
    }

    const action = mixer.clipAction(clip);
    action.reset().fadeIn(0.25).play();

    return () => {
      action.fadeOut(0.2);
      action.stop();
      mixer.stopAllAction();
    };
  }, [animations, mixer]);

  return null;
}

type AvatarAnimationBoundaryProps = {
  children: ReactNode;
};

type AvatarAnimationBoundaryState = {
  hasError: boolean;
};

class AvatarAnimationBoundary extends Component<
  AvatarAnimationBoundaryProps,
  AvatarAnimationBoundaryState
> {
  state: AvatarAnimationBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

function tuneMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];

  for (const item of materials) {
    if ("envMapIntensity" in item) {
      item.envMapIntensity = 0.75;
    }

    item.needsUpdate = true;
  }
}

function fitAvaturnIframe(container: HTMLElement) {
  const iframe = container.querySelector<HTMLIFrameElement>(
    "#avaturn-sdk-iframe, iframe",
  );

  if (!iframe) {
    return;
  }

  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.height = "100%";
  iframe.style.minHeight = "30rem";
  iframe.style.width = "100%";
}

function normalizeAvatarExportUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function findAvatarExportString(payload: Partial<ExportAvatarResult>) {
  const candidates = [
    payload.url,
    (payload as Record<string, unknown>).export_url,
    (payload as Record<string, unknown>).avatar_url,
  ]
    .map(normalizeAvatarExportUrl)
    .filter(Boolean);

  return (
    candidates.find((url) =>
      /^(https:\/\/|data:(model\/gltf-binary|application\/octet-stream);base64,)/i.test(
        url,
      ),
    ) ?? ""
  );
}

function createSafePayload(payload: ExportAvatarResult) {
  return {
    avatarId: payload.avatarId,
    avatarSupportsFaceAnimations: payload.avatarSupportsFaceAnimations,
    bodyId: payload.bodyId,
    gender: payload.gender,
    sessionId: payload.sessionId,
    urlType: payload.urlType,
  };
}
