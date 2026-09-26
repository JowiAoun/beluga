"use client";

// The AfterShokz Trekz Air earbuds in 3D, seen from behind the wearer so their left is the
// screen's left. The contact pad on the side a warning plays lights up and sends out a ring.
// Scrolling on spreads the parts apart.

import { ContactShadows, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Side } from "@/lib/audio/placement";

const MODEL = "/3d/trekz-air.glb";
const SONAR = new THREE.Color("#38bdf8");

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

// Where each part goes when the earbuds come apart, in metres. The wordmarks and the emblem
// carry the AfterShokz marks, so they are left out. `_01` sits at +x, the wearer's left.
const PARTS: { name: PartName; material: "ink_black" | "trekz_blue"; apart: [number, number, number] }[] = [
  { name: "TrekzAir_neckband", material: "trekz_blue", apart: [0, -0.012, -0.05] },
  { name: "TrekzAir_shell_00", material: "trekz_blue", apart: [-0.04, 0.014, 0.005] },
  { name: "TrekzAir_shell_01", material: "trekz_blue", apart: [0.04, 0.014, 0.005] },
  { name: "TrekzAir_rearpod_00", material: "ink_black", apart: [-0.05, -0.006, -0.03] },
  { name: "TrekzAir_rearpod_01", material: "ink_black", apart: [0.05, -0.006, -0.03] },
  { name: "TrekzAir_controls", material: "ink_black", apart: [0.07, 0.006, -0.03] },
  { name: "TrekzAir_button", material: "ink_black", apart: [-0.05, 0.03, 0.03] },
  { name: "TrekzAir_microphone_00", material: "ink_black", apart: [0.05, 0.03, 0.035] },
  { name: "TrekzAir_microphone_01", material: "ink_black", apart: [-0.05, 0.036, 0.02] },
];

const PADS = [
  { name: "TrekzAir_contactpad_01" as const, side: "left" as const, apart: [0.062, 0.01, 0.045] as const },
  { name: "TrekzAir_contactpad_00" as const, side: "right" as const, apart: [-0.062, 0.01, 0.045] as const },
];

function smooth(from: number, to: number, delta: number, speed = 6) {
  return THREE.MathUtils.damp(from, to, speed, delta);
}

function Earbuds({
  side,
  progress,
  still,
  onReady,
}: {
  side: Side | null;
  progress: MotionValue<number>;
  still: boolean;
  onReady: () => void;
}) {
  const { nodes, materials } = useGLTF(MODEL) as unknown as GLTFResult;
  const root = useRef<THREE.Group>(null);
  const parts = useRef<(THREE.Group | null)[]>([]);
  const pads = useRef<(THREE.Group | null)[]>([]);
  const padMaterials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const apart = useRef(0);
  const ringClock = useRef(0);

  useEffect(onReady, [onReady]);

  useFrame((state, delta) => {
    // Come apart over the second half of the section's scroll.
    const target = THREE.MathUtils.smoothstep(progress.get(), 0.52, 0.8);
    apart.current = smooth(apart.current, target, delta, 4);
    const a = apart.current;

    PARTS.forEach((part, i) => parts.current[i]?.position.set(part.apart[0] * a, part.apart[1] * a, part.apart[2] * a));
    PADS.forEach((pad, i) => pads.current[i]?.position.set(pad.apart[0] * a, pad.apart[1] * a, pad.apart[2] * a));

    if (root.current) {
      const t = state.clock.elapsedTime;
      const sway = still ? 0 : Math.sin(t * 0.5) * 0.35;
      root.current.rotation.y = smooth(root.current.rotation.y, sway + a * 0.5, delta, 2);
      root.current.position.y = still ? 0 : Math.sin(t * 0.8) * 0.003;
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
      {PARTS.map((part, i) => {
        const node = nodes[part.name];
        return (
          <group key={part.name} ref={(el) => void (parts.current[i] = el)}>
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
          <group key={pad.name} ref={(el) => void (pads.current[i] = el)}>
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
  progress,
  still,
  onScreen,
  onReady,
  onFallback,
}: {
  side: Side | null;
  progress: MotionValue<number>;
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
      camera={{ position: [0, 0.2, -0.27], fov: 34, near: 0.01, far: 5 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={onFallback} flipflops={3}>
        <Camera />
        <ambientLight intensity={0.7} />
        <directionalLight position={[0.4, 0.6, -0.5]} intensity={2.4} />
        <directionalLight position={[-0.5, 0.2, 0.4]} intensity={1.1} color="#38bdf8" />
        <Suspense fallback={null}>
          <Earbuds side={side} progress={progress} still={still} onReady={onReady} />
        </Suspense>
        <ContactShadows position={[0, -0.002, 0]} opacity={0.55} scale={0.5} blur={2.4} far={0.12} frames={1} />
      </PerformanceMonitor>
    </Canvas>
  );
}

useGLTF.preload(MODEL);
