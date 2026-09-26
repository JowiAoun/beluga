import { cn } from "@/lib/utils";

const W = 1440;
const H = 160;

// The surface line of a wave two screens wide, so sliding it left by half loops without a seam.
function surface(base: number, amp: number, periods: number, phase: number) {
  let d = "";
  for (let x = 0; x <= W * 2; x += 12) {
    const y = base + amp * Math.sin((2 * Math.PI * periods * x) / W + phase);
    d += `${d ? " L" : "M"}${x} ${y.toFixed(1)}`;
  }
  return d;
}

const LAYERS = [
  { line: surface(52, 10, 2, 0), fill: "rgb(56 189 248 / 0.10)", duration: 26 },
  { line: surface(70, 12, 3, 1.4), fill: "rgb(56 189 248 / 0.16)", duration: 19 },
  { line: surface(92, 8, 2, 2.6), fill: "url(#water-deep)", duration: 14 },
];

// Calm water in SVG. Each layer slides at its own speed. Decoration only.
export function Water({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none overflow-hidden", className)}>
      {LAYERS.map((layer, i) => (
        <svg
          key={i}
          viewBox={`0 0 ${W * 2} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-0 h-full w-[200%] motion-safe:animate-drift"
          style={{ animationDuration: `${layer.duration}s` }}
        >
          {i === LAYERS.length - 1 && (
            <defs>
              <linearGradient id="water-deep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.45" stopColor="#0b1320" stopOpacity="0.94" />
                <stop offset="1" stopColor="#0b1320" stopOpacity="0" />
              </linearGradient>
            </defs>
          )}
          <path d={`${layer.line} L${W * 2} ${H} L0 ${H} Z`} fill={layer.fill} />
          {i === LAYERS.length - 1 && (
            <path
              d={layer.line}
              fill="none"
              stroke="rgb(56 189 248 / 0.6)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      ))}
    </div>
  );
}
