import { describe, expect, it } from "vitest";
import type { SensingUpdate } from "@/lib/xr/types";
import { drawDots, drawHeatmap } from "./heatmap";

// Rects are recorded as a share of the canvas, 0 to 1 across.
// A camera at the origin looking down -z, 90° wide, square: column-major like WebXR's matrices.
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const [near, far] = [0.1, 100];
const PROJECTION = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0,
]);

function fakeCanvas() {
  const rects: Array<{ x: number; y: number; fill: string }> = [];
  let fill = "";
  const ctx = {
    clearRect: () => {},
    set fillStyle(v: string) {
      fill = v;
    },
    fillRect: (x: number, y: number) => rects.push({ x: (x + 0.5) / canvas.width, y: (y + 0.5) / canvas.height, fill }),
  };
  const canvas = { clientWidth: 400, clientHeight: 400, width: 0, height: 0, getContext: () => ctx };
  return { canvas: canvas as unknown as HTMLCanvasElement, rects };
}

function update(points: number[], tracking = true): SensingUpdate {
  return {
    tracking,
    points: new Float32Array(points),
    sampleCount: 1728,
    camera: { x: 0, y: 0, z: 0 },
    viewFromWorld: IDENTITY,
    projection: PROJECTION,
  } as unknown as SensingUpdate;
}

const red = (fill: string) => Number(/rgb\((\d+)/.exec(fill)![1]);

describe("drawDots", () => {
  it("puts a point straight ahead in the middle of the screen", () => {
    const { canvas, rects } = fakeCanvas();
    drawDots(canvas, update([0, 0, -2]), true);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(0.5, 1);
    expect(rects[0].y).toBeCloseTo(0.5, 1);
  });

  it("puts a point up and to the right in the top-right quarter", () => {
    const { canvas, rects } = fakeCanvas();
    drawDots(canvas, update([1, 1, -2]), true);
    expect(rects[0].x).toBeGreaterThan(0.5);
    expect(rects[0].y).toBeLessThan(0.5);
  });

  it("colours nearer points warmer", () => {
    const { canvas, rects } = fakeCanvas();
    drawDots(canvas, update([0, 0, -0.5, 0, 0, -3.5]), true);
    expect(red(rects[0].fill)).toBeGreaterThan(red(rects[1].fill));
  });

  it("skips points behind the camera, and draws nothing while tracking is lost", () => {
    const behind = fakeCanvas();
    drawDots(behind.canvas, update([0, 0, 2]), true);
    expect(behind.rects).toHaveLength(0);
    const lost = fakeCanvas();
    drawDots(lost.canvas, update([0, 0, -2], false), true);
    expect(lost.rects).toHaveLength(0);
  });
});

describe("drawHeatmap", () => {
  it("fades the last picture, then lays the dots over it scaled up and blurred", () => {
    const calls: string[] = [];
    const ctx = {
      globalCompositeOperation: "source-over",
      globalAlpha: 1,
      filter: "none",
      fillStyle: "",
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      fillRect: () => calls.push(`fill ${ctx.globalCompositeOperation} ${ctx.globalAlpha}`),
      drawImage: (_image: unknown, _x: number, _y: number, w: number, h: number) =>
        calls.push(`draw ${w}x${h} ${ctx.globalAlpha} ${ctx.filter}`),
    };
    const screen = { clientWidth: 400, clientHeight: 800, width: 0, height: 0, getContext: () => ctx };
    const dots = fakeCanvas();
    drawHeatmap(screen as unknown as HTMLCanvasElement, update([0, 0, -2]), dots.canvas);
    expect(dots.rects).toHaveLength(1);
    // Portrait: the grid is 36 across and 48 down, drawn 8 times bigger.
    expect([screen.width, screen.height]).toEqual([288, 384]);
    expect(calls).toEqual(["fill destination-out 0.5", "draw 288x384 0.6 blur(4.8px)"]);
    expect(ctx.filter).toBe("none");
    expect(ctx.globalAlpha).toBe(1);
  });
});
