import { useEffect, useRef, useState, useCallback } from "react";
import type { Participant, TrackPublication } from "livekit-client";
import { Maximize2, Minimize2, GripVertical } from "lucide-react";

interface HostCameraBubbleProps {
  participant: Participant;
  cameraPublication: TrackPublication;
  containerRef: React.RefObject<HTMLDivElement>;
}

type Corner = "tl" | "tr" | "bl" | "br";
type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 96, md: 140, lg: 200 };
const MARGIN = 12;

/**
 * Floating circular overlay showing the host's camera while they share screen.
 * Each viewer controls position/size locally — no DataChannel, no broadcast.
 * Snaps to nearest corner on drop. Persists per-session in sessionStorage.
 */
const HostCameraBubble = ({ participant, cameraPublication, containerRef }: HostCameraBubbleProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [corner, setCorner] = useState<Corner>(() => {
    try {
      return (sessionStorage.getItem("bullfy-camera-bubble-corner") as Corner) || "br";
    } catch {
      return "br";
    }
  });
  const [size, setSize] = useState<Size>(() => {
    try {
      return (sessionStorage.getItem("bullfy-camera-bubble-size") as Size) || "md";
    } catch {
      return "md";
    }
  });
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Attach camera track
  useEffect(() => {
    const track = cameraPublication.track;
    const el = videoRef.current;
    if (!track || !el) return;
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch {}
    };
  }, [cameraPublication]);

  useEffect(() => {
    try {
      sessionStorage.setItem("bullfy-camera-bubble-corner", corner);
    } catch {}
  }, [corner]);

  useEffect(() => {
    try {
      sessionStorage.setItem("bullfy-camera-bubble-size", size);
    } catch {}
  }, [size]);

  const px = SIZE_PX[size];

  const computeCornerPos = useCallback((c: Corner) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    switch (c) {
      case "tl": return { x: MARGIN, y: MARGIN };
      case "tr": return { x: rect.width - px - MARGIN, y: MARGIN };
      case "bl": return { x: MARGIN, y: rect.height - px - MARGIN };
      case "br": return { x: rect.width - px - MARGIN, y: rect.height - px - MARGIN };
    }
  }, [containerRef, px]);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cur = dragPos ?? computeCornerPos(corner);
    dragOffset.current = {
      dx: e.clientX - rect.left - cur.x,
      dy: e.clientY - rect.top - cur.y,
    };
    setDragPos(cur);
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width - px, e.clientX - rect.left - dragOffset.current.dx));
    const y = Math.max(0, Math.min(rect.height - px, e.clientY - rect.top - dragOffset.current.dy));
    setDragPos({ x, y });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !dragPos) return;
    // Snap to nearest corner
    const cx = dragPos.x + px / 2;
    const cy = dragPos.y + px / 2;
    const isLeft = cx < rect.width / 2;
    const isTop = cy < rect.height / 2;
    const next: Corner = isTop ? (isLeft ? "tl" : "tr") : (isLeft ? "bl" : "br");
    setCorner(next);
    setDragPos(null);
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  };

  const cycleSize = () => {
    setSize((s) => (s === "sm" ? "md" : s === "md" ? "lg" : "sm"));
  };

  const pos = dragPos ?? computeCornerPos(corner);
  const displayName = participant.name || participant.identity;

  return (
    <div
      className="absolute z-30 group"
      style={{
        left: pos.x,
        top: pos.y,
        width: px,
        height: px,
        transition: dragging ? "none" : "left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease",
        touchAction: "none",
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative w-full h-full rounded-full overflow-hidden ring-2 ring-white/80 shadow-2xl bg-black cursor-grab ${
          dragging ? "cursor-grabbing scale-105" : ""
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Drag hint */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-80 transition-opacity bg-black/50 rounded-full p-0.5">
          <GripVertical className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* Resize button — outside the drag area */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); cycleSize(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -bottom-1 -right-1 bg-black/80 hover:bg-black text-white rounded-full p-1.5 shadow-lg ring-1 ring-white/30 opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Tamaño: ${size.toUpperCase()} (clic para cambiar)`}
      >
        {size === "lg" ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </button>

      {/* Name label */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 rounded text-[10px] text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {displayName}
      </div>
    </div>
  );
};

export default HostCameraBubble;
