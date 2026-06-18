import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import TournamentAvatar from "./components/TournamentAvatar";
import TradeTicker from "./components/TradeTicker";

type P = {
  id: string;
  user_id: string;
  rank: number;
  current_score: number;
  profit_pct: number;
  user?: any;
};

/* ---------- Stage geometry (lightweight, no HDR, no shadows on extras) ---------- */

function StageFloor() {
  // Single mesh, simple standard material, soft emissive ring at edge.
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#06122a" metalness={0.55} roughness={0.55} />
      </mesh>
      {/* Outer neon ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[11.7, 12, 96]} />
        <meshBasicMaterial color="#00E5FF" transparent opacity={0.55} />
      </mesh>
      {/* Inner accent ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[4.7, 4.85, 64]} />
        <meshBasicMaterial color="#146EF5" transparent opacity={0.45} />
      </mesh>
    </>
  );
}

function RankPodium({ position, rank }: { position: [number, number, number]; rank: number }) {
  const h = rank === 1 ? 0.55 : rank === 2 ? 0.42 : 0.3;
  const color = rank === 1 ? "#FFD56B" : rank === 2 ? "#cbd5e1" : "#f59e0b";
  return (
    <group position={[position[0], h / 2, position[2]]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, h, 32]} />
        <meshStandardMaterial color="#0a1c3d" metalness={0.5} roughness={0.4} emissive={color} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, h / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 0.98, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/* ---------- Avatar in arena (RPM GLB) ---------- */

function ArenaAvatar({
  url,
  position,
  rank,
}: {
  url: string;
  position: [number, number, number];
  rank: number;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<THREE.Group>(null);
  const baseY = useRef(position[1]);

  // Normalize avatar size + drop shadows only on top 3
  useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const targetH = rank === 1 ? 2.0 : 1.7;
    const s = targetH / Math.max(size.y, 0.01);
    cloned.scale.setScalar(s);
    // Re-center on Y so feet sit at 0
    const newBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.y -= newBox.min.y;
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = rank <= 3;
        o.receiveShadow = false;
        o.frustumCulled = true;
      }
    });
  }, [cloned, rank]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!group.current) return;
    group.current.position.y = baseY.current + Math.sin(t * 1.2 + rank) * 0.04;
    // Subtle look-toward-center
    const lookAngle = Math.atan2(-position[0], -position[2]);
    group.current.rotation.y = lookAngle + Math.sin(t * 0.6 + rank) * 0.08;
  });

  return (
    <group ref={group} position={position}>
      <primitive object={cloned} />
      <Html position={[0, (rank === 1 ? 2.2 : 1.95), 0]} center distanceFactor={9}>
        <div className="px-2 py-0.5 rounded-full bg-black/60 border border-white/15 text-white text-[10px] font-black whitespace-nowrap shadow-lg backdrop-blur">
          #{rank}
        </div>
      </Html>
    </group>
  );
}

function Placeholder({ position, color, rank }: { position: [number, number, number]; color: string; rank: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) ref.current.position.y = 1 + Math.sin(t * 1.5 + rank) * 0.06;
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <capsuleGeometry args={[0.35, 1.1, 6, 12]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.4} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <Html position={[0, 2.0, 0]} center distanceFactor={9}>
        <div className="px-2 py-0.5 rounded-full bg-black/60 border border-white/15 text-white text-[10px] font-black whitespace-nowrap">
          #{rank}
        </div>
      </Html>
    </group>
  );
}

/* ---------- Page ---------- */

export default function TournamentArena() {
  const { slug } = useParams();
  const [t, setT] = useState<any>(null);
  const [parts, setParts] = useState<P[]>([]);

  const load = async () => {
    if (!slug) return;
    const { data: tour } = await supabase
      .from("tournaments")
      .select("id, name, slug, ends_at")
      .eq("slug", slug)
      .maybeSingle();
    setT(tour);
    if (!tour) return;
    const { data: ps } = await supabase
      .from("tournament_participants")
      .select("id, user_id, current_score, profit_pct")
      .eq("tournament_id", tour.id)
      .order("current_score", { ascending: false })
      .limit(6); // keep light
    const ids = (ps || []).map((p) => p.user_id);
    const { data: us } = ids.length
      ? await supabase.from("tournament_users").select("id, full_name, country, username, avatar_url, avatar_config, avatar_3d_url").in("id", ids)
      : { data: [] };
    const map = new Map((us || []).map((u: any) => [u.id, u]));
    setParts((ps || []).map((p, i) => ({ rank: i + 1, ...p, user: map.get(p.user_id) })) as P[]);
  };

  useEffect(() => { load(); }, [slug]);

  useEffect(() => {
    if (!t?.id) return;
    const ch = supabase
      .channel(`arena_${t.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${t.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [t?.id]);

  // Top 3 form a triangle near center, the rest sit on the outer ring.
  const positions: [number, number, number][] = parts.map((_, i) => {
    if (i === 0) return [0, 0, -1.6];
    if (i === 1) return [-1.8, 0, 1.2];
    if (i === 2) return [1.8, 0, 1.2];
    const angle = ((i - 3) / Math.max(parts.length - 3, 1)) * Math.PI * 2;
    return [Math.cos(angle) * 7.5, 0, Math.sin(angle) * 7.5];
  });

  if (!t) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando…</div>;

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Button variant="ghost" asChild className="bg-black/40 backdrop-blur text-white hover:bg-black/60">
          <Link to={`/tournament/t/${slug}/live`}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
        </Button>
        <div className="bg-black/40 backdrop-blur px-3 py-2 rounded-lg border border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-[#00E5FF]">Arena · 3D</div>
          <div className="font-bold">{t.name}</div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 max-w-md w-[calc(100%-2rem)] sm:w-96 bg-black/40 backdrop-blur rounded-lg p-2 border border-white/10">
        <TradeTicker tournamentId={t.id} participants={parts} max={8} />
      </div>

      {/* Bottom roster */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2 overflow-x-auto pb-2">
        {parts.map((p) => (
          <div key={p.id} className="flex-shrink-0 bg-black/50 backdrop-blur rounded-lg p-2 flex items-center gap-2 border border-white/10">
            <TournamentAvatar
              config={p.user?.avatar_config}
              fallbackUrl={p.user?.avatar_url}
              fallbackSeed={p.user?.username || p.user?.full_name}
              mood={p.profit_pct >= 5 ? "happy" : p.profit_pct <= -5 ? "worried" : "idle"}
              size={32}
            />
            <div className="min-w-0">
              <div className="text-[10px] text-[#00E5FF] font-bold">#{p.rank}</div>
              <div className="text-xs font-medium truncate max-w-[100px]">{p.user?.full_name || "—"}</div>
            </div>
            <div className={`text-xs font-mono font-bold ${p.profit_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {p.profit_pct >= 0 ? "+" : ""}{Number(p.profit_pct).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Stage */}
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 4.5, 11], fov: 42 }}
        className="!h-screen"
      >
        <color attach="background" args={["#03060f"]} />
        <fog attach="fog" args={["#03060f", 14, 32]} />

        {/* Cheap, expressive lighting (no Environment HDR) */}
        <hemisphereLight args={["#bcd6ff", "#0a0f1f", 0.55]} />
        <directionalLight
          position={[6, 9, 4]}
          intensity={1.1}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={25}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <pointLight position={[0, 7, 0]} intensity={0.6} color="#00E5FF" />
        <pointLight position={[-8, 3, 6]} intensity={0.35} color="#146EF5" />
        <pointLight position={[8, 3, -6]} intensity={0.35} color="#9b59ff" />

        <Suspense fallback={null}>
          <StageFloor />
          <ContactShadows position={[0, 0.02, 0]} opacity={0.55} scale={20} blur={2.4} far={4} resolution={512} color="#000" />

          {/* Podiums for top 3 */}
          {parts.slice(0, 3).map((p, i) => (
            <RankPodium key={`pod-${p.id}`} position={positions[i]} rank={p.rank} />
          ))}

          {/* Avatars */}
          {parts.map((p, i) => {
            const pos = positions[i];
            const url = p.user?.avatar_3d_url;
            const podiumH = i === 0 ? 0.55 : i === 1 ? 0.42 : i === 2 ? 0.3 : 0;
            const standY = pos[1] + podiumH;
            const color = p.rank === 1 ? "#FFD56B" : p.rank === 2 ? "#cbd5e1" : p.rank === 3 ? "#f59e0b" : "#146EF5";
            return url ? (
              <ArenaAvatar key={p.id} url={url} position={[pos[0], standY, pos[2]]} rank={p.rank} />
            ) : (
              <Placeholder key={p.id} position={[pos[0], standY, pos[2]]} color={color} rank={p.rank} />
            );
          })}
        </Suspense>

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.15}
          minPolarAngle={Math.PI / 6}
          minDistance={7}
          maxDistance={18}
          autoRotate
          autoRotateSpeed={0.35}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
