"use client";

// The AfterShokz Trekz Air earbuds in 3D, seen from behind the wearer so their left is the
// screen's left. The contact pad on the side a warning plays lights up and sends out a ring.

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Watchdog } from "./Watchdog";
import type { Side } from "@/lib/audio/placement";

const MODEL = "/3d/trekz-air.glb";
const SONAR = new THREE.Color("#29b8ff");

type PartName =
  | "TrekzAir_button"
  | "TrekzAir_contactpad_00"
  | "TrekzAir_contactpad_01"
  | "TrekzAir_controls"
  | "TrekzAir_microphone_00"
  | "TrekzAir_microphone_01"
  | "TrekzAir_neckband"
  | "TrekzAir_rearpod_00"
  | "TrekzAir_rearpod_01"
  | "TrekzAir_shell_00"
  | "TrekzAir_shell_01";

type GLTFResult = {
  nodes: Record<PartName, THREE.Mesh>;
  materials: { ink_black: THREE.MeshStandardMaterial; trekz_blue: THREE.MeshStandardMaterial };
};

// The parts and their colours. The wordmarks and the emblem carry the AfterShokz marks, so they
// are left out. `_01` sits at +x, the wearer's left.
const PARTS: { name: PartName; material: "ink_black" | "trekz_blue" }[] = [
  { name: "TrekzAir_neckband", material: "trekz_blue" },
  { name: "TrekzAir_shell_00", material: "trekz_blue" },
  { name: "TrekzAir_shell_01", material: "trekz_blue" },
  { name: "TrekzAir_rearpod_00", material: "ink_black" },
  { name: "TrekzAir_rearpod_01", material: "ink_black" },
  { name: "TrekzAir_controls", material: "ink_black" },
  { name: "TrekzAir_button", material: "ink_black" },
  { name: "TrekzAir_microphone_00", material: "ink_black" },
  { name: "TrekzAir_microphone_01", material: "ink_black" },
];

const PADS = [
  { name: "TrekzAir_contactpad_01" as const, side: "left" as const },
  { name: "TrekzAir_contactpad_00" as const, side: "right" as const },
];

function smooth(from: number, to: number, delta: number, speed = 6) {
  return THREE.MathUtils.damp(from, to, speed, delta);
}

function Earbuds({ side, still, onReady }: { side: Side | null; still: boolean; onReady: () => void }) {
  const { nodes, materials } = useGLTF(MODEL) as unknown as GLTFResult;
  const root = useRef<THREE.Group>(null);
  const padMaterials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const ringClock = useRef(0);
  const born = useRef<number | null>(null);

  useEffect(onReady, [onReady]);

  useFrame((state, delta) => {
    // Starts in the still image's pose, so the fade from the still shows one pair, then eases
    // into its sway over 3 seconds.
    born.current ??= state.clock.elapsedTime;
    const t = state.clock.elapsedTime - born.current;
    const ease = Math.min(1, t / 3);
    if (root.current) {
      const sway = still ? 0 : Math.sin(t * 0.45) * 0.2 * ease;
      root.current.rotation.y = smooth(root.current.rotation.y, sway, delta, 2);
      root.current.position.y = still ? 0 : Math.sin(t * 0.8) * 0.003 * ease;
    }

    ringClock.current = (ringClock.current + delta / 1.1) % 1;
    PADS.forEach((pad, i) => {
      const lit = side === pad.side || side === "ahead";
      const material = padMaterials.current[i];
      if (material) material.emissiveIntensity = smooth(material.emissiveIntensity, lit ? 2.4 : 0, delta, 10);
      const ring = rings.current[i];
      if (ring) {
        ring.visible = lit;
        const s = 0.004 + ringClock.current * 0.05;
        ring.scale.setScalar(s);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ringClock.current) * 0.8;
      }
    });
  });

  return (
    <group ref={root}>
      {PARTS.map((part) => {
        const node = nodes[part.name];
        return (
          <group key={part.name}>
            <mesh
              geometry={node.geometry}
              material={materials[part.material]}
              position={node.position}
              quaternion={node.quaternion}
              scale={node.scale}
            />
          </group>
        );
      })}
      {PADS.map((pad, i) => {
        const node = nodes[pad.name];
        const outward = pad.side === "left" ? 1 : -1;
        return (
          <group key={pad.name}>
            <mesh geometry={node.geometry} position={node.position} quaternion={node.quaternion} scale={node.scale}>
              <meshStandardMaterial
                ref={(el) => void (padMaterials.current[i] = el)}
                map={materials.ink_black.map}
                color="#2a2f36"
                emissive={SONAR}
                emissiveIntensity={0}
                roughness={0.5}
              />
            </mesh>
            <mesh
              ref={(el) => void (rings.current[i] = el)}
              position={[node.position.x + outward * 0.012, node.position.y, node.position.z]}
              rotation={[0, Math.PI / 2, 0]}
              visible={false}
            >
              <ringGeometry args={[0.85, 1, 48]} />
              <meshBasicMaterial color={SONAR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Looks forward and down over the wearer's shoulders.
function Camera() {
  useFrame(({ camera }) => camera.lookAt(0, 0.02, 0.012));
  return null;
}

export default function EarbudsScene({
  side,
  still,
  onScreen,
  onReady,
  onFallback,
}: {
  side: Side | null;
  still: boolean;
  onScreen: boolean;
  onReady: () => void;
  onFallback: () => void;
}) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      aria-hidden
      dpr={[1, dpr]}
      frameloop={onScreen ? "always" : "never"}
      camera={{ position: [0, 0.21, -0.29], fov: 36, near: 0.01, far: 5 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <Watchdog onDpr={setDpr} onFallback={onFallback}>
        <Camera />
        <ambientLight intensity={0.7} />
        <directionalLight position={[0.4, 0.6, -0.5]} intensity={2.4} />
        <directionalLight position={[-0.5, 0.2, 0.4]} intensity={1.1} color="#29b8ff" />
        <Suspense fallback={null}>
          <Earbuds side={side} still={still} onReady={onReady} />
        </Suspense>
        <ContactShadows position={[0, -0.002, 0]} opacity={0.55} scale={0.5} blur={2.4} far={0.12} frames={1} />
      </Watchdog>
    </Canvas>
  );
}

useGLTF.preload(MODEL);
