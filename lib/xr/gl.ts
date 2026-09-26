// The WebGL 2 context an AR session draws with. Chrome drops a page's oldest WebGL context once
// the page has too many (each 3D scene and the detector make their own), so a context made when
// the page loaded can be lost by the time the walk starts.

export function arContext(): WebGL2RenderingContext {
  const gl = document.createElement("canvas").getContext("webgl2", { xrCompatible: true, alpha: true, antialias: false });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");
  return gl;
}

// Readies `gl` for the session and returns the context to draw with: a new one when `gl` was lost.
// This runs after the session is granted, so a new context needs no tap.
export async function xrReady(gl: WebGL2RenderingContext): Promise<WebGL2RenderingContext> {
  const ctx = gl.isContextLost() ? arContext() : gl;
  try {
    await ctx.makeXRCompatible();
    return ctx;
  } catch (err) {
    if (!ctx.isContextLost()) throw err;
    const fresh = arContext();
    await fresh.makeXRCompatible();
    return fresh;
  }
}
