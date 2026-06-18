"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scenarioAsset = "/Scenario.glb";
type CameraMode = "panorama" | "podium";

function enhanceLoadedMaterials(model: THREE.Object3D) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      material.side = THREE.DoubleSide;

      if ("envMapIntensity" in material) {
        material.envMapIntensity = 0.85;
      }
    });
  });
}

export function ScenarioArenaScene({
  showControls = true,
}: {
  showControls?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetRef = useRef(new THREE.Vector3(0, 3.5, 0));
  const lookAtRef = useRef(new THREE.Vector3(0, 3.5, 0));
  const panoramaRef = useRef({
    radius: 11,
    height: 4.4,
    center: new THREE.Vector3(0, 3.5, 0),
  });
  const podiumPoseRef = useRef({
    position: new THREE.Vector3(2.2, 2.2, 7.2),
    target: new THREE.Vector3(0, 3.8, 0),
  });
  const modeRef = useRef<CameraMode>("panorama");
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("panorama");

  const moveCamera = (mode: CameraMode) => {
    modeRef.current = mode;
    setCameraMode(mode);
  };

  const toggleCameraMode = () => {
    moveCamera(modeRef.current === "panorama" ? "podium" : "panorama");
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    const getViewportSize = () => ({
      width: Math.max(1, container.clientWidth),
      height: Math.max(1, container.clientHeight),
    });
    const initialSize = getViewportSize();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061011);

    const camera = new THREE.PerspectiveCamera(39, initialSize.width / initialSize.height, 0.05, 220);
    camera.position.set(2.5, 4.6, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(initialSize.width, initialSize.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const modelRoot = new THREE.Group();
    const mixers: THREE.AnimationMixer[] = [];
    const abortController = new AbortController();
    scene.add(modelRoot);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x1c2a32, 2.1);
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(12, 18, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const fill = new THREE.DirectionalLight(0x8ffff4, 1.8);
    fill.position.set(-12, 8, -10);
    const front = new THREE.PointLight(0xffffff, 45, 80, 2);
    front.position.set(0, 8, 18);
    scene.add(ambient, key, fill, front);

    const loader = new GLTFLoader();
    const loadScenario = async () => {
      try {
        const response = await fetch(scenarioAsset, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const total = Number(response.headers.get("content-length")) || 0;
        let buffer: ArrayBuffer;

        if (response.body) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            chunks.push(value);
            received += value.byteLength;
            if (total > 0) {
              setLoading(Math.round((received / total) * 100));
            }
          }

          const bytes = new Uint8Array(received);
          let offset = 0;
          chunks.forEach((chunk) => {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          });
          buffer = bytes.buffer;
        } else {
          buffer = await response.arrayBuffer();
          setLoading(100);
        }

        if (disposed) return;

        loader.parse(
          buffer,
          "/",
          (gltf) => {
            if (disposed) return;

        const model = gltf.scene;
        enhanceLoadedMaterials(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 28 / maxDim : 1;

        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        modelRoot.add(model);

        const fittedBox = new THREE.Box3().setFromObject(modelRoot);
        const fittedSize = fittedBox.getSize(new THREE.Vector3());
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        const arenaRadius = Math.max(fittedSize.x, fittedSize.z) * 0.4;
        const target = new THREE.Vector3(
          fittedCenter.x,
          fittedBox.min.y + fittedSize.y * 0.24,
          fittedCenter.z,
        );
        const cameraEyeY = fittedBox.min.y + Math.max(3.8, fittedSize.y * 0.44);
        targetRef.current.copy(target);
        lookAtRef.current.copy(target);

        panoramaRef.current = {
          radius: Math.max(4, arenaRadius * 0.9),
          height: cameraEyeY,
          center: target.clone(),
        };

        podiumPoseRef.current = {
          position: new THREE.Vector3(
            fittedCenter.x + arenaRadius * 0.02,
            fittedBox.min.y + fittedSize.y * 0.16,
            fittedCenter.z + arenaRadius * 0.36,
          ),
          target: new THREE.Vector3(
            fittedCenter.x,
            fittedBox.min.y + fittedSize.y * 0.08,
            fittedCenter.z + arenaRadius * 0.02,
          ),
        };

        camera.near = Math.max(0.02, arenaRadius / 220);
        camera.far = arenaRadius * 6;
        camera.position.set(
          target.x + panoramaRef.current.radius * 0.18,
          panoramaRef.current.height,
          target.z + panoramaRef.current.radius,
        );
        camera.updateProjectionMatrix();
        camera.lookAt(target);

        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
          mixers.push(mixer);
        }

        setReady(true);
      },
          (parseError) => {
            console.error(parseError);
            setError("No se pudo interpretar /Scenario.glb");
          },
        );
      } catch (loadError) {
        if (disposed || abortController.signal.aborted) return;
        console.error(loadError);
        setError("No se pudo cargar /Scenario.glb");
      }
    };

    loadScenario();

    const clock = new THREE.Clock();
    const onResize = () => {
      const { width, height } = getViewportSize();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    requestAnimationFrame(onResize);
    window.addEventListener("resize", onResize);

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      mixers.forEach((mixer) => mixer.update(delta));

      const mode = modeRef.current;
      const desiredPosition = new THREE.Vector3();
      const desiredTarget = new THREE.Vector3();

      if (mode === "panorama") {
        const panorama = panoramaRef.current;
        const angle = elapsed * 0.12;
        desiredPosition.set(
          panorama.center.x + Math.sin(angle) * panorama.radius,
          panorama.height,
          panorama.center.z + Math.cos(angle) * panorama.radius,
        );
        desiredTarget.copy(panorama.center);
      } else {
        desiredPosition.copy(podiumPoseRef.current.position);
        desiredTarget.copy(podiumPoseRef.current.target);
      }

      const cameraEase = mode === "panorama" ? 0.025 : 0.065;
      camera.position.lerp(desiredPosition, cameraEase);
      lookAtRef.current.lerp(desiredTarget, 0.05);
      camera.lookAt(lookAtRef.current);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      abortController.abort();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      container.removeChild(renderer.domElement);
      cameraRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="scenario-viewer-scene relative" aria-label="Scenario GLB viewer">
      {/* {showControls ? (
        <div className="fixed" aria-label="Controles de camara">
          <Button variant={"ghost"} type="button" aria-pressed={cameraMode === "podium"} onClick={toggleCameraMode}>
            {cameraMode === "panorama" ? "Ver podio" : "Panoramica"}
          </Button>
        </div>
      ) : null} */}
      {(!ready || error) && (
        <div className="scenario-viewer-loader">
          <span>{error ?? (loading > 0 ? `Cargando Scenario.glb ${loading}%` : "Cargando Scenario.glb")}</span>
        </div>
      )}
    </div>
  );
}
