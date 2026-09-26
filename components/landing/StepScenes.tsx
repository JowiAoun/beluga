// The four pictures beside "How it works", drawn in SVG. Decoration only: each step's text says
// the same thing. The rings and bars move only when motion is allowed, and Pause motion freezes them.

import { SCORE_COLOURS } from "@/app/map/format";

const RING = "motion-safe:animate-pulse-ring [transform-box:fill-box] [transform-origin:center]";

function Rings({ cx, cy, r, count = 3 }: { cx: number; cy: number; r: number; count?: number }) {
  return (
    <g fill="none" stroke="#29b8ff" strokeWidth="2">
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          className={RING}
          opacity={0.5 - i * 0.12}
          style={{ animationDelay: `${(i * 2.4) / count}s` }}
        />
      ))}
    </g>
  );
}

// Where a corridor edge sits at height y, between the phone (y 380) and 3 m ahead (y 120).
function edge(y: number, side: "left" | "right") {
  const t = (380 - y) / 260;
  return side === "left" ? 60 + t * 110 : 340 - t * 110;
}

const BANDS = [340, 302, 266, 232, 200, 170, 143];

// `id` keeps the clip and gradient ids apart when the same picture is on the page twice.
export function DepthScene({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className="size-full">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M60 380 L170 120 L230 120 L340 380 Z" />
        </clipPath>
        <linearGradient id={`${id}-fill`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#29b8ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#29b8ff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d="M60 380 L170 120 L230 120 L340 380 Z" fill={`url(#${id}-fill)`} stroke="#29b8ff" strokeOpacity="0.5" />
      <g clipPath={`url(#${id}-clip)`}>
        {BANDS.map((y) => (
          <line
            key={y}
            x1={edge(y, "left")}
            x2={edge(y, "right")}
            y1={y}
            y2={y}
            stroke="#29b8ff"
            strokeOpacity="0.18"
          />
        ))}
        <rect x="40" y="366" width="320" height="6" fill="#29b8ff" opacity="0.8" className="motion-safe:animate-scan" />
      </g>

      <ellipse cx="166" cy="250" rx="34" ry="11" fill="none" stroke="#29b8ff" strokeWidth="2" className={RING} />
      <rect x="160" y="150" width="12" height="100" rx="3" fill="#eef3f6" />
      <g transform="translate(182 176)">
        <rect width="92" height="30" rx="6" fill="#0f141a" stroke="#29b8ff" strokeOpacity="0.6" />
        <text x="46" y="20" textAnchor="middle" fill="#eef3f6" fontSize="14" fontFamily="var(--font-mono)">
          pole, 2 m
        </text>
      </g>

      <text x="200" y="104" textAnchor="middle" fill="#afbec8" fontSize="14" fontFamily="var(--font-mono)">
        3 m ahead
      </text>
      <text x="200" y="372" textAnchor="middle" fill="#afbec8" fontSize="14" fontFamily="var(--font-mono)">
        0.9 m wide
      </text>
      <rect x="182" y="384" width="36" height="12" rx="6" fill="#29b8ff" />
    </svg>
  );
}

export function SoundScene() {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className="size-full">
      <Rings cx={128} cy={226} r={120} />
      <line x1="84" y1="96" x2="126" y2="200" stroke="#afbec8" strokeDasharray="4 6" />
      <circle cx="80" cy="86" r="12" fill="#eef3f6" />
      <text x="100" y="72" fill="#eef3f6" fontSize="15" fontFamily="var(--font-mono)">
        pole, left
      </text>

      <ellipse cx="200" cy="232" rx="72" ry="82" fill="#161c23" stroke="rgb(255 255 255 / 0.18)" strokeWidth="2" />
      <path d="M188 152 L200 132 L212 152 Z" fill="#161c23" stroke="rgb(255 255 255 / 0.18)" strokeWidth="2" />
      <rect x="116" y="206" width="16" height="44" rx="8" fill="#29b8ff" />
      <rect x="268" y="206" width="16" height="44" rx="8" fill="#2a3542" />
      <text x="124" y="286" textAnchor="middle" fill="#29b8ff" fontSize="16" fontWeight="700">
        L
      </text>
      <text x="276" y="286" textAnchor="middle" fill="#afbec8" fontSize="16" fontWeight="700">
        R
      </text>
      <text x="200" y="370" textAnchor="middle" fill="#afbec8" fontSize="14" fontFamily="var(--font-mono)">
        seen from above
      </text>
    </svg>
  );
}

export function AskScene() {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className="size-full">
      <rect
        x="40"
        y="36"
        width="170"
        height="320"
        rx="30"
        fill="#0f141a"
        stroke="rgb(255 255 255 / 0.2)"
        strokeWidth="2"
      />
      <rect x="56" y="64" width="138" height="170" rx="16" fill="#1d2631" />
      <g stroke="#29b8ff" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M66 88 v-14 h14" />
        <path d="M184 88 v-14 h-14" />
        <path d="M66 210 v14 h14" />
        <path d="M184 210 v14 h-14" />
      </g>
      {/* A scooter lying on its side. */}
      <g stroke="#eef3f6" strokeWidth="5" strokeLinecap="round" fill="none">
        <circle cx="86" cy="182" r="13" />
        <circle cx="160" cy="182" r="13" />
        <path d="M86 182 L160 182" />
        <path d="M160 182 L176 136" />
        <path d="M168 132 L186 138" />
      </g>
      <rect x="72" y="258" width="106" height="56" rx="6" fill="#29b8ff" />
      <text x="125" y="293" textAnchor="middle" fill="#0f141a" fontSize="20" fontWeight="800">
        Ask
      </text>

      <g transform="translate(178 116)">
        <rect width="200" height="112" rx="22" fill="#161c23" stroke="#29b8ff" strokeOpacity="0.6" />
        <text fill="#eef3f6" fontSize="15">
          <tspan x="18" y="36">
            A scooter is lying
          </tspan>
          <tspan x="18" y="58">
            across the sidewalk,
          </tspan>
          <tspan x="18" y="80">
            about 2 m ahead,
          </tspan>
          <tspan x="18" y="102">
            on your right.
          </tspan>
        </text>
      </g>
      <g fill="#29b8ff">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={240 + i * 16}
            y={256}
            width="8"
            height="48"
            rx="4"
            className="motion-safe:animate-eq [transform-box:fill-box] [transform-origin:center]"
            style={{ animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </g>
      <text x="284" y="336" textAnchor="middle" fill="#afbec8" fontSize="14" fontFamily="var(--font-mono)">
        spoken from the right
      </text>
    </svg>
  );
}

// A made-up grid for the picture only, not real reports. 4 is the busiest, like the map.
const CELLS = ["..3.2..", ".21.13.", "2.0410.", ".31.2..", "..2.1.3", ".3..20.", "...1..."];

export function CityScene() {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className="size-full">
      <g transform="translate(46 46)">
        {CELLS.flatMap((row, r) =>
          [...row].map((c, col) => (
            <rect
              key={`${r}-${col}`}
              x={col * 44}
              y={r * 44}
              width="40"
              height="40"
              rx="6"
              fill={c === "." ? "rgb(255 255 255 / 0.05)" : SCORE_COLOURS[Number(c)]}
              opacity={c === "." ? 1 : 0.9}
            />
          )),
        )}
        <rect
          x={3 * 44 - 3}
          y={2 * 44 - 3}
          width="46"
          height="46"
          rx="8"
          fill="none"
          stroke="#eef3f6"
          strokeWidth="3"
        />
        <Rings cx={3 * 44 + 20} cy={2 * 44 + 20} r={70} count={2} />
      </g>
      <g transform="translate(206 38)">
        <rect width="156" height="36" rx="6" fill="#0f141a" stroke="#29b8ff" />
        <text x="78" y="23" textAnchor="middle" fill="#29b8ff" fontSize="14" fontWeight="700">
          #1 fix first
        </text>
      </g>
      <circle cx="90" cy="330" r="16" fill="#0f141a" stroke="#eef3f6" strokeWidth="3" />
      <text x="90" y="336" textAnchor="middle" fill="#eef3f6" fontSize="16" fontWeight="800">
        O
      </text>
      <text x="116" y="336" fill="#afbec8" fontSize="14" fontFamily="var(--font-mono)">
        O-Train station
      </text>
    </svg>
  );
}

export const SCENES: Array<(props: { id: string }) => React.ReactNode> = [DepthScene, SoundScene, AskScene, CityScene];
