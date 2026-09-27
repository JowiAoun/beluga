// Draws the moving depth contours for every <LiveContours> on the page with one WebGL2 context.
// Each frame, a shader draws contour lines of slowly changing noise into a hidden canvas, and
// each section on screen copies its part into its own 2D canvas. One context for the whole page
// leaves the rest for the 3D scenes; sections off screen aren't drawn at all.

const FRAME_MS = 1000 / 30;
// Noise units per second. The lines reshape over about 10 seconds, calm like water.
const SPEED = 0.07;

// Contour lines of 3D simplex noise, anti-aliased to about 1.25 CSS pixels. Noise from Ashima
// Arts and Stefan Gustavson (MIT).
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uOffset;
uniform float uTime;
uniform float uScale;
uniform float uWidth;
uniform vec3 uColour;
out vec4 outColour;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  vec2 p = gl_FragCoord.xy / uScale + uOffset;
  float n = snoise(vec3(p, uTime)) * 0.9 + snoise(vec3(p * 2.0 + 7.3, uTime * 1.4)) * 0.1;
  float v = n * 4.0;
  // Distance to the nearest contour, in pixels.
  float d = abs(fract(v + 0.5) - 0.5) / max(fwidth(v), 1e-4);
  float a = clamp(uWidth * 0.5 + 0.5 - d, 0.0, 1.0);
  outColour = vec4(uColour * a, a);
}`;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offset: [number, number];
  visible: boolean;
  drawn: boolean;
  onDrawn: () => void;
  onFail: () => void;
}

interface Renderer {
  gl: WebGL2RenderingContext;
  uniforms: Record<"uOffset" | "uTime" | "uScale" | "uWidth" | "uColour", WebGLUniformLocation | null>;
}

const entries = new Set<Entry>();
let renderer: Renderer | null = null;
let failed = false;
let observer: IntersectionObserver | null = null;
let frame = 0;
let last = 0;
const started = typeof performance === "undefined" ? 0 : performance.now();

function fail() {
  failed = true;
  renderer = null;
  cancelAnimationFrame(frame);
  frame = 0;
  entries.forEach((e) => e.onFail());
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function setup(): Renderer | null {
  if (renderer || failed) return renderer;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
  const vertex = gl && compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl?.createProgram();
  if (!gl || !vertex || !fragment || !program) {
    failed = true;
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    failed = true;
    return null;
  }
  gl.useProgram(program);
  // One triangle that covers the whole view.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  canvas.addEventListener("webglcontextlost", fail);
  const at = (name: string) => gl.getUniformLocation(program, name);
  renderer = {
    gl,
    uniforms: { uOffset: at("uOffset"), uTime: at("uTime"), uScale: at("uScale"), uWidth: at("uWidth"), uColour: at("uColour") },
  };
  return renderer;
}

// "#434c57" to 0..1 channels. Anything else falls back to the dark tone's line colour.
function colourOf(el: Element): [number, number, number] {
  const hex = getComputedStyle(el).getPropertyValue("--line").trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0.263, 0.298, 0.341];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function draw(now: number) {
  frame = requestAnimationFrame(draw);
  if (now - last < FRAME_MS) return;
  last = now;
  const r = renderer;
  if (!r) return;
  const { gl, uniforms } = r;
  const visible = [...entries].filter((e) => e.visible);
  if (visible.length === 0) {
    cancelAnimationFrame(frame);
    frame = 0;
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const sizes = visible.map((e) => ({
    e,
    w: Math.max(1, Math.round(e.canvas.clientWidth * dpr)),
    h: Math.max(1, Math.round(e.canvas.clientHeight * dpr)),
  }));
  const needW = Math.max(...sizes.map((s) => s.w));
  const needH = Math.max(...sizes.map((s) => s.h));
  // Grows only, so two sections of different sizes don't make it reallocate every frame.
  if (gl.canvas.width < needW || gl.canvas.height < needH) {
    gl.canvas.width = Math.max(gl.canvas.width, needW);
    gl.canvas.height = Math.max(gl.canvas.height, needH);
  }
  const t = ((now - started) / 1000) * SPEED;
  for (const { e, w, h } of sizes) {
    if (e.canvas.width !== w || e.canvas.height !== h) {
      e.canvas.width = w;
      e.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.uOffset, e.offset[0], e.offset[1]);
    gl.uniform1f(uniforms.uTime, t);
    // Shapes about half the section wide, within sensible limits.
    gl.uniform1f(uniforms.uScale, Math.min(640, Math.max(280, (w / dpr) * 0.42)) * dpr);
    gl.uniform1f(uniforms.uWidth, 1.25 * dpr);
    gl.uniform3f(uniforms.uColour, ...colourOf(e.canvas));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // WebGL draws from the bottom-left, so this section's pixels are the bottom rows.
    e.ctx.clearRect(0, 0, w, h);
    e.ctx.drawImage(gl.canvas as HTMLCanvasElement, 0, gl.canvas.height - h, w, h, 0, 0, w, h);
    if (!e.drawn) {
      e.drawn = true;
      e.onDrawn();
    }
  }
}

function wake() {
  if (!frame && renderer) frame = requestAnimationFrame(draw);
}

// Starts drawing into `canvas` while it is on screen. Returns the function that stops it.
// `onFail` fires when this browser can't draw them, so the still lines stay.
export function attachContours(
  canvas: HTMLCanvasElement,
  seed: number,
  onDrawn: () => void,
  onFail: () => void,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || !setup()) {
    onFail();
    return () => {};
  }
  const entry: Entry = { canvas, ctx, offset: [seed * 13.1, seed * 7.7], visible: false, drawn: false, onDrawn, onFail };
  entries.add(entry);
  observer ??= new IntersectionObserver((records) => {
    for (const record of records) {
      for (const e of entries) if (e.canvas === record.target) e.visible = record.isIntersecting;
    }
    wake();
  });
  observer.observe(canvas);
  return () => {
    entries.delete(entry);
    observer?.unobserve(canvas);
  };
}
