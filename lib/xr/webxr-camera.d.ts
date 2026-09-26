// Chrome's raw camera access (the "camera-access" feature) is missing from @types/webxr.
// https://immersive-web.github.io/raw-camera-access/

interface XRCamera {
  readonly width: number;
  readonly height: number;
}

interface XRView {
  readonly camera?: XRCamera | null;
}

interface XRWebGLBinding {
  getCameraImage(camera: XRCamera): WebGLTexture | null;
}
