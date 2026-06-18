import { forwardRef } from "react";
import { Trophy } from "lucide-react";

interface StoryCardProps {
  tournamentName: string;
  rank: number;
  fullName: string;
  country?: string;
  score: number;
  profitPct: number;
  trades: number;
  winrate: number;
  slug: string;
  avatarUrl?: string | null;
}

const StoryCardExport = forwardRef<HTMLDivElement, StoryCardProps>(
  ({ tournamentName, rank, fullName, country, score, profitPct, trades, winrate, slug, avatarUrl }, ref) => {
    const positive = profitPct >= 0;
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: "linear-gradient(160deg, #062B63 0%, #0a4090 45%, #146EF5 100%)",
          color: "white",
          fontFamily: "Figtree, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: 80,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Glow circles */}
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(131,203,255,0.35), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -300, left: -200, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,110,245,0.5), transparent 70%)" }} />

        {/* Header */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, opacity: 0.85 }}>BULLFY TOURNAMENT</div>
          <div style={{ fontSize: 56, fontWeight: 900, marginTop: 16, lineHeight: 1.05 }}>{tournamentName}</div>
        </div>

        {/* Rank */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, opacity: 0.8, marginBottom: 24 }}>MI POSICIÓN</div>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <Trophy size={120} color="#FFD56B" strokeWidth={2.5} />
            <div style={{ fontSize: 360, fontWeight: 900, lineHeight: 1, background: "linear-gradient(180deg, #fff, #83CBFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              #{rank}
            </div>
          </div>
          <div style={{ marginTop: 32, fontSize: 64, fontWeight: 800 }}>{fullName}</div>
          {country && <div style={{ fontSize: 36, opacity: 0.7, marginTop: 8 }}>{country}</div>}
        </div>

        {/* Stats */}
        <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <Stat label="Score" value={score.toFixed(2)} accent="#83CBFF" />
          <Stat label="P/L" value={`${positive ? "+" : ""}${profitPct.toFixed(2)}%`} accent={positive ? "#4ade80" : "#f87171"} />
          <Stat label="Winrate" value={`${winrate.toFixed(1)}%`} accent="#FFD56B" />
          <Stat label="Trades" value={String(trades)} accent="#fff" />
        </div>

        {/* Footer */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 28, opacity: 0.85, marginBottom: 12 }}>Participa en el torneo</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#83CBFF" }}>bullfytech.online/tournament/t/{slug}</div>
        </div>
      </div>
    );
  }
);
StoryCardExport.displayName = "StoryCardExport";

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 32, padding: "32px 40px", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontSize: 28, opacity: 0.7, letterSpacing: 2, fontWeight: 600 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 72, fontWeight: 900, color: accent, marginTop: 8 }}>{value}</div>
    </div>
  );
}

export default StoryCardExport;
