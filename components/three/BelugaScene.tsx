"use client";

// The beluga mascot riding a wave, for the hero. The model's parts are baked in place, so the
// tail and flippers turn around pivots found from their bounds. Sonar rings leave the melon
// (the forehead bump real belugas echolocate from) and travel ahead of the muzzle.

import { ContactShadows, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const MODEL = "/3d/beluga.glb";
const SONAR = new THREE.Color("#38bdf8");
// The model faces +x. Turned so its face and sunglasses come toward the camera.
const TURN = -0.95;
// The melon, just above and behind the sunglasses.
const MELON = new THREE.Vector3(3.55, 5.55, 0);
const RINGS = 3;
const RING_SECONDS = 2.4;

type Role = "body" | "tail" | "nearFlipper" | "farFlipper" | "droplet" | "sea";

function roleOf(name: string): Role {
  if (name.startsWith("Tail")) return "tail";
  if (name.startsWith("Near pectoral")) return "nearFlipper";
  if (name.startsWith("Far pectoral")) return "farFlipper";
  if (name.startsWith("Water droplet")) return "droplet";
  if (name.startsWith("Wave") || name.startsWith("Foam")) return "sea";
  return "body";
}

interface Part {
  name: string;
  mesh: THREE.Mesh;
  role: Role;
  box: THREE.Box3;
}

// World bounds of a mesh, from its quantized positions and its node transform.
function boundsOf(mesh: THREE.Mesh) {
  const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position as THREE.BufferAttribute);
  return box.applyMatrix4(new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale));
}

function Piece({ part }: { part: Part }) {
  return (
    <mesh
      geometry={part.mesh.geometry}
      material={part.mesh.material}
      position={part.mesh.position}
      quaternion={part.mesh.quaternion}
      scale={part.mesh.scale}
    />
  );
}

// Children turn around `pivot` (world coordinates) while staying where the model put them.
function Pivot({
  pivot,
  groupRef,
  children,
}: {
  pivot: THREE.Vector3;
  groupRef: (el: THREE.Group | null) => void;
  children: React.ReactNode;
}) {
  return (
    <group position={pivot}>
      <group ref={groupRef}>
        <group position={[-pivot.x, -pivot.y, -pivot.z]}>{children}</group>
      </group>
    </group>
  );
}

function Beluga({ still, progress, onReady }: { still: boolean; progress: MotionValue<number>; onReady: () => void }) {
  const { nodes } = useGLTF(MODEL) as unknown as { nodes: Record<string, THREE.Object3D> };
  const parts = useMemo<Part[]>(
    () =>
      Object.entries(nodes)
        .filter((entry): entry is [string, THREE.Mesh] => (entry[1] as THREE.Mesh).isMesh)
        .map(([name, mesh]) => ({ name, mesh, role: roleOf(name), box: boundsOf(mesh) })),
    [nodes],
  );

  // The flukes join the body at their inner end; the flippers at their top.
  const pivots = useMemo(() => {
    const join = (role: Role) =>
      parts.filter((p) => p.role === role).reduce((box, p) => box.union(p.box), new THREE.Box3());
    const tail = join("tail");
    const near = join("nearFlipper");
    const far = join("farFlipper");
    return {
      tail: new THREE.Vector3(tail.max.x, (tail.min.y + tail.max.y) / 2 - 0.3, 0),
      near: new THREE.Vector3((near.min.x + near.max.x) / 2, near.max.y, near.min.z),
      far: new THREE.Vector3((far.min.x + far.max.x) / 2, far.max.y, far.max.z),
      body: new THREE.Vector3(0.6, 4.2, 0),
    };
  }, [parts]);

  const body = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const near = useRef<THREE.Group | null>(null);
  const far = useRef<THREE.Group | null>(null);
  const droplets = useRef<(THREE.Group | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(onReady, [onReady]);

  useFrame((state) => {
    const t = still ? 0 : state.clock.elapsedTime;
    const dive = progress.get();
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.1) * 0.12 - dive * 0.6;
      body.current.rotation.z = Math.sin(t * 1.1 + 0.8) * 0.035 - dive * 0.15;
    }
    if (tail.current) tail.current.rotation.z = Math.sin(t * 2.2) * 0.22;
    if (near.current) near.current.rotation.x = Math.sin(t * 1.8) * 0.18;
    if (far.current) far.current.rotation.x = -Math.sin(t * 1.8) * 0.18;
    droplets.current.forEach((d, i) => {
      if (d) d.position.y = Math.sin(t * 1.6 + i * 1.3) * 0.08;
    });
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      ring.visible = !still;
      const phase = (t / RING_SECONDS + i / RINGS) % 1;
      ring.position.set(MELON.x + 0.4 + phase * 2.4, MELON.y + phase * 0.15, MELON.z);
      ring.scale.setScalar(0.25 + phase * 1.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.55;
    });
  });

  const of = (role: Role) => parts.filter((p) => p.role === role);

  return (
    <group rotation={[0, TURN, 0]} position={[-0.2, -3.1, 0]}>
      {of("sea").map((p) => (
        <Piece key={p.name} part={p} />
      ))}
      {of("droplet").map((p, i) => (
        <group key={p.name} ref={(el) => void (droplets.current[i] = el)}>
          <Piece part={p} />
        </group>
      ))}
      <Pivot pivot={pivots.body} groupRef={(el) => void (body.current = el)}>
        {of("body").map((p) => (
          <Piece key={p.name} part={p} />
        ))}
        <Pivot pivot={pivots.tail} groupRef={(el) => void (tail.current = el)}>
          {of("tail").map((p) => (
            <Piece key={p.name} part={p} />
          ))}
        </Pivot>
        <Pivot pivot={pivots.near} groupRef={(el) => void (near.current = el)}>
          {of("nearFlipper").map((p) => (
            <Piece key={p.name} part={p} />
          ))}
        </Pivot>
        <Pivot pivot={pivots.far} groupRef={(el) => void (far.current = el)}>
          {of("farFlipper").map((p) => (
            <Piece key={p.name} part={p} />
          ))}
        </Pivot>
        {Array.from({ length: RINGS }, (_, i) => (
          <mesh key={i} ref={(el) => void (rings.current[i] = el)} rotation={[0, Math.PI / 2, 0]} visible={false}>
            <ringGeometry args={[0.95, 1, 64]} />
            <meshBasicMaterial color={SONAR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
      </Pivot>
    </group>
  );
}

export default function BelugaScene({
  still,
  progress,
  onScreen,
  onReady,
  onFallback,
}: {
  still: boolean;
  progress: MotionValue<number>;
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
      camera={{ position: [0, 1.2, 17.5], fov: 30, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={onFallback} flipflops={3}>
        <hemisphereLight args={["#dff4ff", "#0b1320", 1.1]} />
        <directionalLight position={[6, 10, 8]} intensity={2.2} />
        <directionalLight position={[-8, 3, -4]} intensity={1.6} color="#38bdf8" />
        <Suspense fallback={null}>
          <Beluga still={still} progress={progress} onReady={onReady} />
        </Suspense>
        <ContactShadows position={[0, -3.2, 0]} opacity={0.4} scale={14} blur={2.8} far={4} frames={1} />
      </PerformanceMonitor>
    </Canvas>
  );
}

useGLTF.preload(MODEL);
