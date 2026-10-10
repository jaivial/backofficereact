import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";

/**
 * Hermes - the Myth mascot robot (from the MythAgent dashboard mascot library,
 * what Jaime calls the MythCortex mascot), rendered as the Forky assistant
 * character. Drop-in replacement for the old ThinkingOrb:
 * accepts the same orb state names and maps them to procedural motion, since
 * the source GLB ships without animation clips.
 */
export type HermesState =
  | "breathing"
  | "working"
  | "composing"
  | "shaping"
  | "listening"
  | "solving";

const MODEL_URL = "/mascot/mascot.glb";
/** Self-hosted Draco decoder (copied from three/examples/jsm/libs/draco/gltf). */
const DRACO_PATH = "/draco/";
const CAMERA_FOV = 32;
const CAMERA_MARGIN = 1.3;

type GLTFResult = { scene: THREE.Group };

function HermesModel({
  state,
  reduceMotion,
}: {
  state: HermesState;
  reduceMotion: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH) as GLTFResult;
  const anim = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  const { center, dimensions } = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene);
    return {
      center: bounds.getCenter(new THREE.Vector3()),
      dimensions: bounds.getSize(new THREE.Vector3()),
    };
  }, [scene]);

  // Fit the camera to the model bounds once, the same framing the previous
  // viewer used.
  useLayoutEffect(() => {
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.5);
    const tangent = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
    const heightDistance = (dimensions.y * CAMERA_MARGIN * 0.5) / tangent;
    const widthDistance = (dimensions.x * CAMERA_MARGIN * 0.5) / (tangent * aspect);
    const distance = Math.max(heightDistance, widthDistance, dimensions.z * 2.2, 2.2);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.near = distance / 100;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
  }, [camera, dimensions, size.height, size.width]);

  useFrame(({ clock }, delta) => {
    const g = anim.current;
    if (!g || reduceMotion) return;
    const t = clock.getElapsedTime();
    let bob = Math.sin(t * 1.4) * 0.045;
    let sway = Math.sin(t * 0.9) * 0.04;
    let spin = 0;
    let tiltX = 0;
    switch (state) {
      case "working":
      case "solving":
        spin = delta * 1.6;
        bob = Math.sin(t * 3.2) * 0.06;
        break;
      case "composing":
        tiltX = Math.sin(t * 5) * 0.07;
        bob = Math.sin(t * 2.2) * 0.04;
        break;
      case "shaping":
        bob = Math.abs(Math.sin(t * 3.4)) * 0.14;
        spin = delta * 2.2;
        break;
      case "listening":
        bob = Math.sin(t * 2.6) * 0.07;
        sway = Math.sin(t * 1.8) * 0.08;
        break;
      case "breathing":
      default:
        break;
    }
    g.position.y = bob;
    g.rotation.z = sway;
    g.rotation.x = tiltX;
    g.rotation.y += spin;
  });

  return (
    <group position={[-center.x, -center.y, -center.z]}>
      <group ref={anim}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

export function HermesMascot({
  state = "breathing",
  size = 64,
  className,
  testId,
}: {
  state?: HermesState;
  size?: number;
  className?: string;
  testId?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <div
      className={className}
      data-testid={testId ?? "hermes-mascot"}
      style={{ width: size, height: size, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: CAMERA_FOV, position: [0, 0, 3] }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={1.25} />
        <pointLight position={[-4, -2, 3]} intensity={0.4} color="#8ab4ff" />
        <Suspense fallback={null}>
          <HermesModel state={state} reduceMotion={reduceMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL, DRACO_PATH);
