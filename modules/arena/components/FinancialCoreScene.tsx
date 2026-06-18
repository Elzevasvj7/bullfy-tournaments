"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type StationStatus = "winning" | "neutral" | "risk" | "eliminated";

type StationState = {
  group: THREE.Group;
  pad: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  status: StationStatus;
  phase: number;
  baseIntensity: number;
};

type CandleState = {
  group: THREE.Group;
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  wick: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  x: number;
  phase: number;
  side: number;
};

const STATION_STATUSES: StationStatus[] = [
  "winning",
  "winning",
  "winning",
  "neutral",
  "neutral",
  "neutral",
  "neutral",
  "risk",
  "risk",
  "risk",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
  "eliminated",
];

const STATUS_COLOR: Record<StationStatus, number> = {
  winning: 0x22ff9a,
  neutral: 0x38bdf8,
  risk: 0xff9d2e,
  eliminated: 0x1b2730,
};

const vertexShader = `
  uniform float uTime;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float drift = sin(uTime * 0.7 + aSeed * 8.0 + p.y * 0.5);
    p.x += drift * 0.1;
    p.z += cos(uTime * 0.55 + aSeed * 5.0) * 0.1;
    vAlpha = 0.35 + 0.65 * sin(uTime * 1.6 + aSeed * 12.0);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (4.0 + aSeed * 10.0) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, glow * vAlpha * 0.62);
  }
`;

function createParticleField() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 28;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = -1 + Math.random() * 10;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#74fff0") },
    },
  });

  return new THREE.Points(geometry, material);
}

function createArenaRings() {
  const group = new THREE.Group();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x071113,
    metalness: 0.82,
    roughness: 0.38,
    emissive: 0x04272b,
    emissiveIntensity: 0.38,
  });
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x5cf9e5,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 18.5, 0.22, 160), floorMaterial);
  floor.position.y = -0.24;
  floor.receiveShadow = true;
  group.add(floor);

  [7.2, 12.2, 16.8, 20.6].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018 + index * 0.01, 8, 220), lineMaterial);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.04 + index * 0.05;
    group.add(ring);
  });

  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(angle) * 7.5, 0.08, Math.sin(angle) * 7.5),
      new THREE.Vector3(Math.cos(angle) * 18.1, 0.08, Math.sin(angle) * 18.1),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x43ffe0, transparent: true, opacity: i % 2 ? 0.08 : 0.16 }),
    );
    group.add(line);
  }

  return group;
}

function createStation(index: number, status: StationStatus): StationState {
  const group = new THREE.Group();
  const angle = (index / 20) * Math.PI * 2 - Math.PI * 0.5;
  const radius = 15.2;
  const color = STATUS_COLOR[status];
  const active = status !== "eliminated";

  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  group.rotation.y = -angle + Math.PI * 0.5;

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.42, 2.35),
    new THREE.MeshStandardMaterial({
      color: active ? 0x07181b : 0x030607,
      emissive: color,
      emissiveIntensity: active ? 0.62 : 0.04,
      metalness: 0.74,
      roughness: 0.25,
    }),
  );
  pad.position.y = 0.26;
  pad.castShadow = true;
  pad.receiveShadow = true;

  const console = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.88, 0.18),
    new THREE.MeshStandardMaterial({
      color: active ? 0x0b2226 : 0x050708,
      emissive: color,
      emissiveIntensity: active ? 0.38 : 0.02,
      metalness: 0.65,
      roughness: 0.2,
    }),
  );
  console.position.set(0, 0.88, -0.78);
  console.rotation.x = -0.28;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.88, 2.4, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: active ? 0.16 : 0.018,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 1.55;

  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(0.93, 0.035, 8, 64),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: active ? 0.62 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  marker.rotation.x = Math.PI * 0.5;
  marker.position.y = 0.56;

  const light = new THREE.PointLight(color, active ? 8 : 0.35, 5.5, 2);
  light.position.set(0, 1.2, -0.1);

  group.add(pad, console, beam, marker, light);

  return {
    group,
    pad,
    light,
    beam,
    status,
    phase: index * 0.47,
    baseIntensity: status === "winning" ? 12 : status === "neutral" ? 7 : status === "risk" ? 9 : 0.28,
  };
}

function createMarketCore() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.25, 4),
    new THREE.MeshStandardMaterial({
      color: 0x061113,
      emissive: 0x42fff0,
      emissiveIntensity: 1.1,
      metalness: 0.9,
      roughness: 0.14,
      wireframe: true,
    }),
  );
  group.add(core);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x8ffff2,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.05 + i * 0.45, 0.018, 8, 180), ringMaterial);
    ring.rotation.x = Math.PI * 0.5 + i * 0.42;
    ring.rotation.y = i * 0.58;
    group.add(ring);
  }

  return group;
}

function createMarketCandles() {
  const group = new THREE.Group();
  const candles: CandleState[] = [];

  for (let i = 0; i < 42; i += 1) {
    const side = i % 5 === 0 || i % 7 === 0 ? -1 : 1;
    const color = side > 0 ? 0x22ff9a : 0xff5c58;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1, 0.16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        metalness: 0.35,
        roughness: 0.18,
      }),
    );
    const wick = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 1, 0.025),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    );
    const candle = new THREE.Group();
    candle.add(body, wick);
    group.add(candle);
    candles.push({ group: candle, body, wick, x: -4.5 + i * 0.22, phase: i * 0.31, side });
  }

  group.position.set(0, 2.55, 0);
  group.userData.candles = candles;
  return group;
}

function animateCandles(group: THREE.Group, elapsed: number) {
  const candles = group.userData.candles as CandleState[] | undefined;
  if (!candles) return;

  candles.forEach((candle, index) => {
    const height = 0.35 + Math.abs(Math.sin(elapsed * 1.6 + candle.phase)) * 1.75;
    const wave = Math.sin(index * 0.42 + elapsed * 1.2) * 0.9;
    candle.group.position.set(candle.x, wave, Math.sin(index * 0.28 + elapsed) * 0.35);
    candle.body.scale.y = height;
    candle.body.position.y = height * 0.5 * candle.side;
    candle.wick.scale.y = height * 1.65;
    candle.wick.position.y = height * 0.26 * candle.side;
  });
}

function createDataArcs() {
  const group = new THREE.Group();

  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2 - Math.PI * 0.5;
    const status = STATION_STATUSES[i];
    const color = STATUS_COLOR[status];
    const active = status !== "eliminated";
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(angle) * 13.5, 0.8, Math.sin(angle) * 13.5),
      new THREE.Vector3(Math.cos(angle) * 8.4, 2.5 + (i % 3) * 0.45, Math.sin(angle) * 8.4),
      new THREE.Vector3(Math.cos(angle) * 3.4, 1.7, Math.sin(angle) * 3.4),
    ]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: active ? 0.26 : 0.035,
        blending: THREE.AdditiveBlending,
      }),
    );
    line.userData.phase = i * 0.2;
    group.add(line);
  }

  return group;
}

export function FinancialCoreScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020607, 0.038);

    const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 110);
    camera.position.set(0, 14, 24);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const world = new THREE.Group();
    const arena = createArenaRings();
    const marketCore = createMarketCore();
    const candles = createMarketCandles();
    const arcs = createDataArcs();
    const particles = createParticleField();
    const particleMaterial = particles.material as THREE.ShaderMaterial;
    const stations = STATION_STATUSES.map((status, index) => createStation(index, status));

    stations.forEach((station) => world.add(station.group));
    marketCore.add(candles);
    world.add(arena, marketCore, arcs, particles);
    scene.add(world);

    const ambient = new THREE.HemisphereLight(0x74fff0, 0x081014, 0.72);
    const key = new THREE.SpotLight(0xeaffff, 85, 52, Math.PI * 0.25, 0.72, 2);
    key.position.set(0, 22, 4);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const gold = new THREE.PointLight(0xf2d46b, 20, 25, 2);
    gold.position.set(-6, 4, 6);
    scene.add(ambient, key, key.target, gold);

    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2();
    const smoothMouse = new THREE.Vector2();
    const scroll = { target: 0, current: 0 };
    let frameId = 0;

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(event.clientY / window.innerHeight - 0.5) * 2;
    };

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.target = max > 0 ? window.scrollY / max : 0;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
      onScroll();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      scroll.current += (scroll.target - scroll.current) * 0.06;
      smoothMouse.lerp(mouse, 0.06);

      const finalPressure = THREE.MathUtils.smoothstep(scroll.current, 0.42, 0.92);
      const orbit = elapsed * 0.075 + scroll.current * Math.PI * 1.25;
      const radius = THREE.MathUtils.lerp(24, 15.5, finalPressure);
      camera.position.x += (Math.sin(orbit) * radius + smoothMouse.x * 1.8 - camera.position.x) * 0.045;
      camera.position.z += (Math.cos(orbit) * radius + smoothMouse.y * 1.2 - camera.position.z) * 0.045;
      camera.position.y += (THREE.MathUtils.lerp(14, 8.6, finalPressure) - camera.position.y) * 0.045;
      camera.lookAt(0, THREE.MathUtils.lerp(1.6, 2.8, finalPressure), 0);

      world.rotation.y = Math.sin(elapsed * 0.12) * 0.025 + smoothMouse.x * 0.035;
      arena.rotation.y = elapsed * 0.012;
      arcs.rotation.y = elapsed * 0.035;
      marketCore.rotation.y = elapsed * 0.24;
      marketCore.rotation.x = Math.sin(elapsed * 0.35) * 0.08;
      candles.rotation.y = -marketCore.rotation.y;
      animateCandles(candles, elapsed);

      stations.forEach((station, index) => {
        const pulse = 0.78 + Math.sin(elapsed * 2.4 + station.phase) * 0.22;
        const finalist = index < 5;
        const eliminated = station.status === "eliminated";
        const pressureBoost = finalPressure * (finalist ? 8 : eliminated ? -0.2 : -2.2);
        station.light.intensity = Math.max(0.05, station.baseIntensity * pulse + pressureBoost);
        station.beam.material.opacity = eliminated
          ? 0.015
          : THREE.MathUtils.clamp(0.08 + pulse * 0.1 + (finalist ? finalPressure * 0.14 : 0), 0.05, 0.36);
        station.pad.material.emissiveIntensity = eliminated
          ? 0.025
          : THREE.MathUtils.clamp(0.28 + pulse * 0.38 + (finalist ? finalPressure * 0.55 : 0), 0.12, 1.4);
        station.group.scale.setScalar(1 + (finalist ? finalPressure * 0.18 : 0));
      });

      arcs.children.forEach((line, index) => {
        if (line instanceof THREE.Line) {
          const material = line.material as THREE.LineBasicMaterial;
          const active = STATION_STATUSES[index] !== "eliminated";
          material.opacity = active ? 0.18 + Math.sin(elapsed * 2 + index) * 0.08 : 0.025;
        }
      });

      gold.intensity = 16 + Math.sin(elapsed * 2.2) * 4 + finalPressure * 26;
      particleMaterial.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      container.removeChild(renderer.domElement);
      world.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
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

  return <div ref={containerRef} className="financial-core-scene" aria-hidden="true" />;
}
