import { createCameraReader, type CameraReader } from "@/lib/xr/cameraImage";
import { fieldOfView, orientationOf, type FieldOfView } from "@/lib/xr/projection";
import type { Report } from "./checks";
import { errorText } from "./sensors";

export interface LiveStats {
  fps: number;
  centreDepth: number | null;
  depthValidShare: number | null;
  hitFloorBelowPhone: number | null;
  fov: { portrait: FieldOfView | null; landscape: FieldOfView | null };
  trackingLost: boolean;
}

interface XrCheckOptions {
  session: XRSession;
  gl: WebGL2RenderingContext;
  report: Report;
  onLive: (stats: LiveStats) => void;
  preview: HTMLCanvasElement | null;
}

// The spec makes these getters throw when depth sensing wasn't granted.
function depthState(session: XRSession): { usage: XRDepthUsage; format: XRDepthDataFormat } | null {
  try {
    const usage = session.depthUsage;
    const format = session.depthDataFormat;
    return usage && format ? { usage, format } : null;
  } catch {
    return null;
  }
}

// Up component of the hit's surface normal (the pose's y axis). A floor is close to 1.
function normalUp(q: DOMPointReadOnly): number {
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}

const GRID_X = 12;
const GRID_Y = 9;
const PREVIEW_WIDTH = 160;

// Runs until the session ends, reporting each XR check as it passes.
export async function runXrCheck({ session, gl, report, onLive, preview }: XrCheckOptions): Promise<void> {
  const ended = new Promise<void>((resolve) => session.addEventListener("end", () => resolve(), { once: true }));

  const listed = session.enabledFeatures;
  const granted = (feature: string) => (listed ? listed.includes(feature) : undefined);
  report(
    "session",
    "pass",
    listed ? `granted: ${listed.join(", ")}` : "started; Chrome did not list the granted features",
  );

  // Chrome drops an optional DOM overlay without an error, so check the state.
  const overlay = session.domOverlayState?.type;
  report(
    "domOverlay",
    overlay ? "pass" : "fail",
    overlay ? `type ${overlay}` : "not granted: this page stays hidden in AR. Press back to end the test.",
  );

  let baseLayer: XRWebGLLayer;
  try {
    await gl.makeXRCompatible();
    baseLayer = new XRWebGLLayer(session, gl, { alpha: true, antialias: false, depth: false });
    session.updateRenderState({ baseLayer });
  } catch (err) {
    report("session", "fail", `could not attach WebGL: ${errorText(err)}`);
    await session.end().catch(() => {});
    return;
  }

  let refSpace: XRReferenceSpace;
  let localFloor = true;
  try {
    refSpace = await session.requestReferenceSpace("local-floor");
  } catch {
    localFloor = false;
    refSpace = await session.requestReferenceSpace("local");
  }

  let hitTestSource: XRHitTestSource | undefined;
  try {
    const viewer = await session.requestReferenceSpace("viewer");
    hitTestSource = await session.requestHitTestSource?.({ space: viewer });
  } catch (err) {
    report("hitTest", "fail", errorText(err));
  }
  if (hitTestSource) report("hitTest", "running", "point the phone at the floor");
  else if (granted("hit-test") === false) report("hitTest", "fail", "not granted");

  const depth = depthState(session);
  const depthOn = granted("depth-sensing") ?? depth !== null;
  report(
    "depth",
    depthOn ? "running" : "fail",
    depthOn ? `granted (${depth?.usage ?? "?"}, ${depth?.format ?? "?"}); move the phone slowly` : "not granted",
  );

  let reader: CameraReader | null = null;
  let binding: XRWebGLBinding | null = null;
  if (granted("camera-access") === false) {
    report("camera", "fail", "not granted");
  } else if (typeof XRWebGLBinding === "undefined") {
    report("camera", "fail", "XRWebGLBinding is missing");
  } else {
    try {
      binding = new XRWebGLBinding(session, gl);
      reader = createCameraReader(gl);
      report("camera", "running", "waiting for an image");
    } catch (err) {
      report("camera", "fail", errorText(err));
    }
  }
  const previewCtx = preview?.getContext("2d") ?? null;

  const fov: LiveStats["fov"] = { portrait: null, landscape: null };
  let frames = 0;
  let lostFrames = 0;
  let windowStart = performance.now();
  let windowFrames = 0;
  let fps = 0;
  let lastLive = 0;
  let lastCamera = 0;
  let depthSeen = false;
  let depthError = "";
  let depthDetail = "";
  let cameraSeen = false;
  let hitSeen = false;
  let centreDepth: number | null = null;
  let depthValidShare: number | null = null;
  let hitFloorBelowPhone: number | null = null;
  let hitDistance: number | null = null;
  let heightAboveFloor: number | null = null;
  let trackingLost = false;

  const describeFov = (f: FieldOfView | null) =>
    f ? `${f.horizontal.toFixed(1)}° wide × ${f.vertical.toFixed(1)}° tall` : "not measured yet";

  const publish = () => {
    onLive({ fps, centreDepth, depthValidShare, hitFloorBelowPhone, fov, trackingLost });

    if (depthSeen) report("depth", "pass", depthDetail);
    else if (depthError) report("depth", "fail", depthError);

    if (hitSeen && hitFloorBelowPhone !== null && hitDistance !== null) {
      report(
        "hitTest",
        "pass",
        `floor ${hitFloorBelowPhone.toFixed(2)} m below the phone, hit ${hitDistance.toFixed(2)} m away`,
      );
    }

    const floorGuess = heightAboveFloor === null ? "" : `; phone ${heightAboveFloor.toFixed(2)} m above it`;
    report(
      "floor",
      localFloor ? "pass" : "warn",
      localFloor ? `granted (a fixed guess on phones${floorGuess})` : "fell back to local; floor must come from hit test",
    );

    const both = fov.portrait && fov.landscape;
    report(
      "fov",
      both ? "pass" : "running",
      `portrait ${describeFov(fov.portrait)}; landscape ${describeFov(fov.landscape)}` +
        (both ? "" : ". Turn the phone to measure the other one (auto-rotate on)."),
    );

    const lostShare = frames + lostFrames > 0 ? lostFrames / (frames + lostFrames) : 0;
    report(
      "tracking",
      "info",
      `${fps.toFixed(0)} frames/s, tracking lost in ${Math.round(lostShare * 100)}% of frames` +
        (trackingLost ? " (lost now)" : ""),
    );
  };

  let over = false;
  const onFrame: XRFrameRequestCallback = (_time, frame) => {
    if (over) return;
    session.requestAnimationFrame(onFrame);
    gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const now = performance.now();
    windowFrames++;
    if (now - windowStart >= 1000) {
      fps = (windowFrames * 1000) / (now - windowStart);
      windowFrames = 0;
      windowStart = now;
    }

    const pose = frame.getViewerPose(refSpace);
    trackingLost = !pose || pose.emulatedPosition;
    if (trackingLost) lostFrames++;
    else frames++;

    if (pose) {
      const view = pose.views[0];
      const f = fieldOfView(view.projectionMatrix);
      fov[orientationOf(f)] = f;
      if (localFloor) heightAboveFloor = pose.transform.position.y;

      if (depthOn) {
        try {
          const info = frame.getDepthInformation(view);
          if (info) {
            const centre = info.getDepthInMeters(0.5, 0.5);
            centreDepth = centre > 0 ? centre : null;
            let valid = 0;
            for (let gx = 0; gx < GRID_X; gx++) {
              for (let gy = 0; gy < GRID_Y; gy++) {
                const d = info.getDepthInMeters((gx + 0.5) / GRID_X, (gy + 0.5) / GRID_Y);
                if (d >= 0.2 && d <= 5) valid++;
              }
            }
            depthValidShare = valid / (GRID_X * GRID_Y);
            if (centreDepth !== null) depthSeen = true;
            depthDetail =
              `${info.width} × ${info.height} ${depth?.format ?? ""}, ` +
              `centre ${centreDepth === null ? "no reading" : `${centreDepth.toFixed(2)} m`}, ` +
              `${Math.round(depthValidShare * 100)}% of points valid`;
          }
        } catch (err) {
          depthError = errorText(err);
        }
      }

      if (binding && reader && view.camera && now - lastCamera > 500) {
        lastCamera = now;
        const texture = binding.getCameraImage(view.camera);
        if (texture) {
          const width = PREVIEW_WIDTH;
          const height = Math.max(1, Math.round((PREVIEW_WIDTH * view.camera.height) / view.camera.width));
          const image = reader.read(texture, width, height);
          if (previewCtx && preview) {
            preview.width = width;
            preview.height = height;
            previewCtx.putImageData(new ImageData(image.data, width, height), 0, 0);
          }
          cameraSeen = true;
          report("camera", "pass", `${view.camera.width} × ${view.camera.height}; check the preview is upright`);
        }
      }

      if (hitTestSource) {
        const hit = frame.getHitTestResults(hitTestSource)[0]?.getPose(refSpace);
        // Only a flat surface counts: a hit on a wall says nothing about the floor.
        if (hit && normalUp(hit.transform.orientation) > 0.9) {
          const phone = pose.transform.position;
          const at = hit.transform.position;
          hitFloorBelowPhone = phone.y - at.y;
          hitDistance = Math.hypot(phone.x - at.x, phone.y - at.y, phone.z - at.z);
          hitSeen = true;
        }
      }
    }

    if (now - lastLive > 200) {
      lastLive = now;
      publish();
    }
  };
  session.requestAnimationFrame(onFrame);

  await ended;
  over = true;

  publish();
  if (depthOn && !depthSeen) {
    report("depth", "fail", depthError || "no depth readings: this phone may lack ARCore depth, or it needs slow movement");
  }
  if (binding && !cameraSeen) report("camera", "fail", "granted but no image arrived");
  if (hitTestSource && !hitSeen) report("hitTest", "fail", "no hits: point the phone at the floor next time");
  if (!(fov.portrait && fov.landscape)) {
    report(
      "fov",
      fov.portrait || fov.landscape ? "warn" : "fail",
      `portrait ${describeFov(fov.portrait)}; landscape ${describeFov(fov.landscape)}`,
    );
  }
  const lostShare = frames + lostFrames > 0 ? lostFrames / (frames + lostFrames) : 1;
  report("tracking", lostShare < 0.1 ? "pass" : "warn", `${fps.toFixed(0)} frames/s, tracking lost in ${Math.round(lostShare * 100)}% of frames`);
  try {
    hitTestSource?.cancel();
  } catch {
    // Already cancelled when the session ended.
  }
  reader?.dispose();
}
