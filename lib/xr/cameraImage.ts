// Shrinks the AR camera texture into a small RGBA image on the GPU, then reads it back.
// Reading the full camera texture every frame would stall the safety loop, so callers
// ask for a small size (preview, detector input, or the Gemini frame on request).

export interface SmallImage {
  width: number;
  height: number;
  // RGBA, top row first, ready for new ImageData().
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface CameraReader {
  // Call inside the XR animation frame: the camera texture is only valid there.
  read(texture: WebGLTexture, width: number, height: number): SmallImage;
  dispose(): void;
}

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

// flipY: GL reads rows bottom first. Whether Chrome's camera texture also starts at the
// bottom is checked on the phone with the device check preview; flip it here if upside down.
export function createCameraReader(gl: WebGL2RenderingContext, flipY = true): CameraReader {
  const program = link(gl);
  const uTex = gl.getUniformLocation(program, "uTex");
  const aPos = gl.getAttribLocation(program, "aPos");

  const vao = gl.createVertexArray();
  const quad = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let target: { framebuffer: WebGLFramebuffer; texture: WebGLTexture; width: number; height: number } | null =
    null;
  let pixels = new Uint8Array(0);

  function ensureTarget(width: number, height: number) {
    if (target && target.width === width && target.height === height) return target;
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    pixels = new Uint8Array(width * height * 4);
    target = { framebuffer, texture, width, height };
    return target;
  }

  return {
    read(texture, width, height) {
      const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
      const previousViewport = gl.getParameter(gl.VIEWPORT) as Int32Array;

      const out = ensureTarget(width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTex, 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Hand the XR layer its framebuffer back, or the next frame renders into ours.
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
      gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);

      const data = new Uint8ClampedArray(width * height * 4);
      const row = width * 4;
      for (let y = 0; y < height; y++) {
        const from = flipY ? height - 1 - y : y;
        data.set(pixels.subarray(from * row, (from + 1) * row), y * row);
      }
      return { width, height, data };
    },

    dispose() {
      if (target) {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.texture);
        target = null;
      }
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}

// Keeps the camera's aspect and shrinks it so the long edge fits. Never scales up.
export function fitLongEdge(width: number, height: number, longEdge: number): { width: number; height: number } {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function encodeJpeg(image: SmallImage, quality: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas for the JPEG");
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
