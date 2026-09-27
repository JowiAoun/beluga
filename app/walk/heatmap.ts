// The depth heatmap on the walking screen: every depth point the walk is using, drawn where it sits
// in the camera view and coloured by how far away it is, warm near and blue far. A view for the
// curious, off by default. It only reads the update the hazard engine gets, and never changes it.

import { SENSING } from "@/lib/shared/params";
import type { SensingUpdate } from "@/lib/xr/types";

export const HEATMAP_FAR_M = 4;

// Near to far. The legend on the walking screen draws the same stops. The colour changes about as
// much for each metre, so depth noise flickers no more at 2 to 3 m than anywhere else.
export const HEATMAP_STOPS = ["#ff4d4d", "#ff9f1c", "#ffe066", "#9be38f", "#3cc8e0", "#1c3c6b"] as const;

const SHADES = 64;

// The screen picture is this many times the size of the depth grid, and blurred by this share of a
// cell, so the dots run together into one smooth field.
const SCALE = 8;
const BLUR_CELLS = 0.6;
// Each update fades the last picture by half and lays the new one over it at 60%, so noise from
// one update to the next doesn't flicker and an empty spot fades out in about 0.3 s. The page's
// see-through level allows for the picture never quite reaching full cover.
const FADE = 0.5;
const NEW = 0.6;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

// A colour for each of 64 steps from near to far, worked out once.
const LUT: string[] = Array.from({ length: SHADES }, (_, i) => {
  const at = (i / (SHADES - 1)) * (HEATMAP_STOPS.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(HEATMAP_STOPS.length - 1, lo + 1);
  const f = at - lo;
  const a = channels(HEATMAP_STOPS[lo]);
  const b = channels(HEATMAP_STOPS[hi]);
  const [r, g, bl] = a.map((c, k) => Math.round(c + (b[k] - c) * f));
  return `rgb(${r}, ${g}, ${bl})`;
});

// Draws one solid dot per depth point on a canvas the size of the depth grid, turned to match the
// screen, so every point has its own pixel.
export function drawDots(canvas: HTMLCanvasElement, update: SensingUpdate, portrait: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cols, rows } = SENSING.depthGrid;
  const long = Math.max(cols, rows);
  const short = Math.min(cols, rows);
  const gw = portrait ? short : long;
  const gh = portrait ? long : short;
  if (canvas.width !== gw || canvas.height !== gh) {
    canvas.width = gw;
    canvas.height = gh;
  }
  ctx.clearRect(0, 0, gw, gh);
  const { points, projection: p, viewFromWorld: v, camera } = update;
  const count = points.length / 3;
  if (!update.tracking || count === 0) return;

  // clip = projection × view, column-major, worked out once per update.
  const m = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += p[k * 4 + row] * v[col * 4 + k];
      m[col * 4 + row] = sum;
    }
  }
  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0) continue;
    const gx = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw + 1) / 2) * gw;
    const gy = ((1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw) / 2) * gh;
    const d = Math.hypot(x - camera.x, y - camera.y, z - camera.z);
    const shade = Math.min(SHADES - 1, Math.round((d / HEATMAP_FAR_M) * (SHADES - 1)));
    ctx.fillStyle = LUT[shade];
    ctx.fillRect(Math.floor(gx), Math.floor(gy), 1, 1);
  }
}

// The grid-sized canvas the dots go on before they are softened onto the screen.
let dotsCanvas: HTMLCanvasElement | null = null;

// Draws the heatmap on the screen canvas: the dots scaled up and blurred into a smooth field, over
// a faded copy of the last picture. The page stretches the result over the screen.
export function drawHeatmap(canvas: HTMLCanvasElement, update: SensingUpdate, dots?: HTMLCanvasElement): void {
  const source = dots ?? (dotsCanvas ??= document.createElement("canvas"));
  drawDots(source, update, canvas.clientHeight > canvas.clientWidth);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = source.width * SCALE;
  const h = source.height * SCALE;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = FADE;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = NEW;
  ctx.filter = `blur(${SCALE * BLUR_CELLS}px)`;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}
