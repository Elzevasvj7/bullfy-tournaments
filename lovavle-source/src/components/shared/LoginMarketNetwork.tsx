import { useMemo } from "react";

export const hexToRgba = (hex: string | undefined, alpha: number) => {
  if (!hex) return `rgba(20, 110, 245, ${alpha})`;
  const safeHex = hex.replace("#", "");
  const normalized = safeHex.length === 3
    ? safeHex.split("").map((char) => char + char).join("")
    : safeHex;

  if (normalized.length !== 6) return `rgba(20, 110, 245, ${alpha})`;

  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface LoginMarketNetworkProps {
  primaryColor?: string;
}

export const LoginMarketNetwork = ({ primaryColor }: LoginMarketNetworkProps) => {
  const candles = useMemo(
    () => [
      { x: 7, y: 70, h: 12, delay: "0s", type: "up" },
      { x: 13, y: 58, h: 18, delay: "-2s", type: "down" },
      { x: 20, y: 64, h: 14, delay: "-4s", type: "up" },
      { x: 28, y: 48, h: 24, delay: "-1s", type: "up" },
      { x: 36, y: 56, h: 16, delay: "-3s", type: "down" },
      { x: 44, y: 40, h: 22, delay: "-5s", type: "up" },
      { x: 52, y: 46, h: 18, delay: "-2.5s", type: "up" },
      { x: 60, y: 36, h: 26, delay: "-6s", type: "down" },
      { x: 68, y: 44, h: 18, delay: "-3.5s", type: "up" },
      { x: 76, y: 30, h: 28, delay: "-1.5s", type: "up" },
      { x: 84, y: 38, h: 20, delay: "-4.5s", type: "down" },
      { x: 92, y: 26, h: 24, delay: "-2.2s", type: "up" },
    ],
    []
  );

  const lineColor = hexToRgba(primaryColor, 0.18);
  const glowColor = hexToRgba(primaryColor, 0.42);
  const bodyUp = hexToRgba(primaryColor, 0.52);
  const bodyDown = "rgba(255,255,255,0.24)";
  const strokeColor = hexToRgba(primaryColor, 0.88);
  const pulseColor = hexToRgba(primaryColor, 0.9);
  const pulseTailColor = hexToRgba(primaryColor, 0.16);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${hexToRgba(primaryColor, 0.22)}, transparent 34%), radial-gradient(circle at 80% 30%, ${hexToRgba(primaryColor, 0.16)}, transparent 30%), radial-gradient(circle at 50% 60%, ${hexToRgba(primaryColor, 0.08)}, transparent 42%)`,
        }}
      />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-100">
        <defs>
          <linearGradient id="market-grid-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={hexToRgba(primaryColor, 0.2)} />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>
          <radialGradient id="market-pulse-core">
            <stop offset="0%" stopColor={pulseColor} />
            <stop offset="45%" stopColor={hexToRgba(primaryColor, 0.72)} />
            <stop offset="100%" stopColor={pulseTailColor} />
          </radialGradient>
        </defs>

        {candles.slice(0, -1).map((candle, index) => {
          const next = candles[index + 1];
          const travelDuration = 3.8 + index * 0.22;
          return (
            <g key={`connection-${index}`}>
              <line
                x1={candle.x}
                y1={candle.y}
                x2={next.x}
                y2={next.y}
                stroke={hexToRgba(primaryColor, 0.28)}
                strokeWidth="0.42"
                strokeLinecap="round"
                strokeDasharray="1.2 1.4"
              />
              <line
                x1={candle.x}
                y1={candle.y}
                x2={next.x}
                y2={next.y}
                stroke={lineColor}
                strokeWidth="0.72"
                strokeLinecap="round"
                opacity="0.28"
              />
              <circle cx={candle.x} cy={candle.y} r="0.9" fill={glowColor}>
                <animate attributeName="opacity" values="0.2;0.75;0.2" dur="5.8s" begin={candle.delay} repeatCount="indefinite" />
                <animate attributeName="r" values="0.7;1.25;0.7" dur="5.8s" begin={candle.delay} repeatCount="indefinite" />
              </circle>
              <circle cx={candle.x} cy={candle.y} r="1.6" fill="url(#market-pulse-core)" opacity="0">
                <animate attributeName="cx" values={`${candle.x};${next.x}`} dur={`${travelDuration}s`} begin={candle.delay} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${candle.y};${next.y}`} dur={`${travelDuration}s`} begin={candle.delay} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.95;0.95;0" dur={`${travelDuration}s`} begin={candle.delay} repeatCount="indefinite" />
                <animate attributeName="r" values="0.6;1.8;1.1;0.7" dur={`${travelDuration}s`} begin={candle.delay} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        <path
          d="M 6 73 C 15 69, 22 62, 30 54 S 44 42, 53 45 S 67 31, 76 34 S 88 24, 95 27"
          fill="none"
          stroke="url(#market-grid-glow)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeDasharray="1.5 2"
        >
          <animate attributeName="opacity" values="0.34;0.82;0.34" dur="8s" repeatCount="indefinite" />
        </path>

        {candles.map((candle, index) => {
          const bodyColor = candle.type === "up" ? bodyUp : bodyDown;
          const wickTop = candle.y - candle.h * 0.65;
          const wickBottom = candle.y + candle.h * 0.7;
          const bodyTop = candle.y - candle.h * 0.45;
          const bodyHeight = candle.h * 0.9;

          return (
            <g key={`candle-${index}`}>
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0; 0 -1.7; 0 0"
                  dur="6.2s"
                  begin={candle.delay}
                  repeatCount="indefinite"
                />
                <line
                  x1={candle.x}
                  y1={wickTop}
                  x2={candle.x}
                  y2={wickBottom}
                  stroke={strokeColor}
                  strokeWidth="0.42"
                  strokeLinecap="round"
                />
                <rect
                  x={candle.x - 0.95}
                  y={bodyTop}
                  width="1.9"
                  height={bodyHeight}
                  rx="0.3"
                  fill={bodyColor}
                  stroke={hexToRgba(primaryColor, candle.type === "up" ? 0.72 : 0.36)}
                  strokeWidth="0.22"
                />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};