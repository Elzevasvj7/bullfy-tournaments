"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EyeIcon, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import type { ArenaParticipant } from "../types";

type TournamentArenaSceneProps = {
  participants: ArenaParticipant[];
  spectators: number;
  tournamentName: string;
};

const SCENARIO_MODEL_URL = "/Scenario.glb";
const DEFAULT_SCENE_TRANSFORM = {
  rotationY: 0,
  scale: 1,
};

type ScenarioBounds = {
  center: THREE.Vector3;
  radius: number;
};

export function TournamentArenaScene({
  participants,
  spectators,
  tournamentName,
}: TournamentArenaSceneProps) {
  const [sceneTransform, setSceneTransform] = useState(DEFAULT_SCENE_TRANSFORM);
  const [scenarioBounds, setScenarioBounds] = useState<ScenarioBounds | null>(
    null,
  );

  return (
    <div className="relative h-[clamp(42rem,76vh,58rem)] overflow-hidden bg-[#02070c]">
      <Canvas
        camera={{
          position: [0, 8.5, 22],
          fov: 42,
        }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <color attach="background" args={["#02070c"]} />
        <fog attach="fog" args={["#02070c", 24, 58]} />
        <CameraDirector bounds={scenarioBounds} />
        <SceneOrbitControls bounds={scenarioBounds} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[2, 9, 5]}
          intensity={1.6}
          color="#d8f6ff"
        />
        <pointLight
          position={[0, 5, 2]}
          intensity={4}
          color="#26d9ff"
          distance={18}
        />
        <Suspense fallback={null}>
          <ScenarioArenaModel
            onBoundsReady={setScenarioBounds}
            transform={sceneTransform}
          />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(2,7,12,0.84),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(2,7,12,0.84),transparent)]" />

      <div className="absolute left-5 top-5 z-10 max-w-[min(28rem,calc(100%-2.5rem))]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
            Arena en vivo
          </p>
          <span className="rounded-sm border bg-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            Live
          </span>
          <span className="border border-cyan-300/20 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
            {participants.length}/20 contendientes
          </span>
        </div>
        <h2 className="mt-3 max-w-md truncate text-4xl font-black uppercase tracking-tight text-white">
          {tournamentName}
        </h2>
      </div>

      <div className="absolute right-5 top-5 z-10 grid gap-2 text-right">
        <ArenaReadout label="Espectadores" value={String(spectators)} />
      </div>

      <SceneControls
        onReset={() => setSceneTransform(DEFAULT_SCENE_TRANSFORM)}
        onRotateLeft={() =>
          setSceneTransform((current) => ({
            ...current,
            rotationY: current.rotationY - Math.PI / 10,
          }))
        }
        onRotateRight={() =>
          setSceneTransform((current) => ({
            ...current,
            rotationY: current.rotationY + Math.PI / 10,
          }))
        }
        onZoomIn={() =>
          setSceneTransform((current) => ({
            ...current,
            scale: Math.min(current.scale + 0.08, 1.5),
          }))
        }
        onZoomOut={() =>
          setSceneTransform((current) => ({
            ...current,
            scale: Math.max(current.scale - 0.08, 0.65),
          }))
        }
      />
    </div>
  );
}

function CameraDirector({ bounds }: { bounds: ScenarioBounds | null }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !bounds) {
      camera.lookAt(new THREE.Vector3(0, 0.35, 0));
      return;
    }

    const distance = Math.max(bounds.radius * 1.9, 10);
    camera.position.set(
      bounds.center.x,
      bounds.center.y + distance * 0.42,
      bounds.center.z + distance,
    );
    camera.updateProjectionMatrix();
    camera.lookAt(bounds.center);
  }, [bounds, camera]);

  return null;
}

function SceneOrbitControls({ bounds }: { bounds: ScenarioBounds | null }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 4;
    controls.maxDistance = 80;
    controls.minPolarAngle = Math.PI / 7;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.copy(bounds?.center ?? new THREE.Vector3(0, 1.4, 0));
    controls.update();

    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [bounds, camera, gl]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

function ScenarioArenaModel({
  onBoundsReady,
  transform,
}: {
  onBoundsReady: (bounds: ScenarioBounds) => void;
  transform: typeof DEFAULT_SCENE_TRANSFORM;
}) {
  const gltf = useLoader(GLTFLoader, SCENARIO_MODEL_URL);

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxHorizontalSize = Math.max(size.x, size.z, 1);
    const scale = 20 / maxHorizontalSize;

    clone.scale.setScalar(scale);
    clone.position.set(
      -center.x * scale,
      -box.min.y * scale - 0.08,
      -center.z * scale,
    );

    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.castShadow = false;
      object.receiveShadow = true;
      object.frustumCulled = true;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        if ("envMapIntensity" in material) {
          material.envMapIntensity = 0.7;
        }
        material.needsUpdate = true;
      });
    });

    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    onBoundsReady({
      center: sphere.center.clone(),
      radius: sphere.radius,
    });
  }, [model, onBoundsReady]);

  return (
    <group rotation={[0, transform.rotationY, 0]} scale={transform.scale}>
      <primitive object={model} />
    </group>
  );
}

function ArenaReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <EyeIcon className="size-4 text-cyan-100/70" />
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
        {label}
      </p>
      <p className="font-mono text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SceneControls({
  onReset,
  onRotateLeft,
  onRotateRight,
  onZoomIn,
  onZoomOut,
}: {
  onReset: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute bottom-5 left-5 z-10 flex overflow-hidden border border-cyan-300/15 bg-black/40 backdrop-blur">
      <SceneControlButton label="Rotar izquierda" onClick={onRotateLeft}>
        <RotateCcw className="size-4" />
      </SceneControlButton>
      <SceneControlButton label="Rotar derecha" onClick={onRotateRight}>
        <RotateCw className="size-4" />
      </SceneControlButton>
      <SceneControlButton label="Alejar" onClick={onZoomOut}>
        <Minus className="size-4" />
      </SceneControlButton>
      <SceneControlButton label="Acercar" onClick={onZoomIn}>
        <Plus className="size-4" />
      </SceneControlButton>
      <SceneControlButton label="Reset" onClick={onReset}>
        <span className="text-[10px] font-black uppercase tracking-[0.12em]">
          Reset
        </span>
      </SceneControlButton>
    </div>
  );
}

function SceneControlButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 min-w-10 items-center justify-center border-r border-cyan-300/10 px-3 text-cyan-100 transition last:border-r-0 hover:bg-cyan-300/10"
    >
      {children}
    </button>
  );
}
