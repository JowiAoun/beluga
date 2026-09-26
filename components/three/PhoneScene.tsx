"use client";

// The phone on its chest mount, with the walking corridor (0.9 m wide, 3 m ahead) fanning out
// from its camera. A depth scan runs up the corridor, and the pole lights and rings as the scan
// reaches it. The phone is drawn 4 times its real size so it reads next to the corridor.

import { Clone, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MODEL = "/3d/phone.glb";
const SONAR = new THREE.Color("#29b8ff");
const PHONE_SCALE = 4;
const PHONE_AT = new THREE.Vector3(0, 1.05, 0);
// The wide lens on the back of the phone, in the model's metres.
const LENS = new THREE.Vector3(0.0195, 0.0575, -0.009);
const HALF_WIDTH = 0.45;
const NEAR = -0.3;
const FAR = -3;
const POLE = new THREE.Vector3(-0.26, 0, -2);
const SCAN_SECONDS = 2.2;

const lensAt = PHONE_AT.clone().add(LENS.clone().multiplyScalar(PHONE_SCALE));

// The light from the lens down to the corridor: two side walls and the far end.
function frustumGeometry() {
  const nl = new THREE.Vector3(-HALF_WIDTH, 0, NEAR);
  const nr = new THREE.Vector3(HALF_WIDTH, 0, NEAR);
  const fl = new THREE.Vector3(-HALF_WIDTH, 0, FAR);
  const fr = new THREE.Vector3(HALF_WIDTH, 0, FAR);
  const points = [lensAt, nl, fl, lensAt, fr, nr, lensAt, fl, fr];
  return new THREE.BufferGeometry().setFromPoints(points);
}

function edgesGeometry() {
  const corners = [
    new THREE.Vector3(-HALF_WIDTH, 0, NEAR),
    new THREE.Vector3(HALF_WIDTH, 0, NEAR),
    new THREE.Vector3(-HALF_WIDTH, 0, FAR),
    new THREE.Vector3(HALF_WIDTH, 0, FAR),
  ];
  const points: THREE.Vector3[] = [];
  for (const c of corners) points.push(lensAt, c);
  points.push(corners[0], corners[2], corners[1], corners[3], corners[2], corners[3], corners[0], corners[1]);
  return new THREE.BufferGeometry().setFromPoints(points);
}

// Built once: they don't change, and every copy of the scene can share them.
const FRUSTUM = frustumGeometry();
const EDGES = edgesGeometry();

function Scene({ still, onReady }: { still: boolean; onReady: () => void }) {
  const { scene } = useGLTF(MODEL);
  const phone = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Mesh>(null);
  const pole = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);

  useEffect(onReady, [onReady]);

  useFrame((state) => {
    const t = still ? 0.9 : state.clock.elapsedTime;
    if (phone.current) {
      phone.current.position.y = PHONE_AT.y + (still ? 0 : Math.abs(Math.sin(t * 3.2)) * 0.012);
      phone.current.rotation.z = still ? 0 : Math.sin(t * 1.6) * 0.015;
    }
    const phase = (t / SCAN_SECONDS) % 1;
    const z = NEAR + (FAR - NEAR) * phase;
    if (scan.current) {
      scan.current.position.z = z;
      (scan.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.9;
    }
    // The pole lights up as the scan reaches it and fades as the scan moves on.
    const near = Math.max(0, 1 - Math.abs(z - POLE.z) / 0.6);
    if (pole.current) pole.current.emissiveIntensity = still ? 0.8 : near * 1.6;
    if (ring.current) {
      const r = (((t / SCAN_SECONDS) % 1) + 0.45) % 1;
      ring.current.visible = !still;
      ring.current.scale.setScalar(0.1 + r * 0.5);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.7;
    }
  });

  return (
    <>
      <group ref={phone} position={PHONE_AT} rotation={[0, 0.3, 0]} scale={PHONE_SCALE}>
        <Clone object={scene} />
      </group>

      <mesh geometry={FRUSTUM}>
        <meshBasicMaterial color={SONAR} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={EDGES}>
        <lineBasicMaterial color={SONAR} transparent opacity={0.45} />
      </lineSegments>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, (NEAR + FAR) / 2]}>
        <planeGeometry args={[HALF_WIDTH * 2, NEAR - FAR]} />
        <meshBasicMaterial color={SONAR} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {[-0.8, -1.3, -1.8, -2.3, -2.8].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, z]}>
          <planeGeometry args={[HALF_WIDTH * 2, 0.008]} />
          <meshBasicMaterial color={SONAR} transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, NEAR]}>
        <planeGeometry args={[HALF_WIDTH * 2, 0.05]} />
        <meshBasicMaterial color={SONAR} transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh position={[POLE.x, 0.55, POLE.z]}>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 20]} />
        <meshStandardMaterial ref={pole} color="#e6edf2" emissive={SONAR} emissiveIntensity={0} roughness={0.4} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[POLE.x, 0.004, POLE.z]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color={SONAR} transparent opacity={0} depthWrite={false} />
      </mesh>

      <gridHelper args={[12, 24, "#2a3542", "#1d2631"]} position={[0, 0, -1.5]} />
    </>
  );
}

// Looks over the wearer's shoulder, down the corridor, the way they face.
function Camera() {
  useFrame(({ camera }) => camera.lookAt(-0.05, 0.45, -1.6));
  return null;
}

export default function PhoneScene({
  still,
  active,
  onScreen,
  onReady,
  onFallback,
}: {
  still: boolean;
  active: boolean;
  onScreen: boolean;
  onReady: () => void;
  onFallback: () => void;
}) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      aria-hidden
      dpr={[1, dpr]}
      frameloop={onScreen && active ? "always" : "never"}
      camera={{ position: [0.55, 1.6, 1.25], fov: 42, near: 0.05, far: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={onFallback} flipflops={3}>
        <Camera />
        <hemisphereLight args={["#dff4ff", "#0b1320", 1.2]} />
        <directionalLight position={[2, 4, 3]} intensity={2} />
        <directionalLight position={[-3, 2, -2]} intensity={1.2} color="#29b8ff" />
        <Suspense fallback={null}>
          <Scene still={still} onReady={onReady} />
        </Suspense>
      </PerformanceMonitor>
    </Canvas>
  );
}

useGLTF.preload(MODEL);
