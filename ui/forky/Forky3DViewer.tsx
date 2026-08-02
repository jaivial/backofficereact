import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, useAnimations, useGLTF, useProgress } from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";

export type ForkyState = "idle" | "greet" | "talk" | "think" | "happy";

const FORKY_MODEL_URL = import.meta.env.VITE_FORKY_MODEL_URL || "/assets/forky/forky.glb";
const CLIPS = ["idle", "greet", "talk", "think", "happy"];
const CAMERA_FOV = 32;
const CAMERA_MARGIN = 1.18;

type GLTFResult = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

function ForkyModel({ state, gltf }: { state: ForkyState; gltf: GLTFResult }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = gltf;
  const { actions } = useAnimations(animations, group);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const target = group.current;
    if (!target || reduceMotion) return;
    const ctx = gsap.context(() => {
      gsap.to(target.position, { y: 0.045, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(target.rotation, { z: 0.035, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, target);
    return () => ctx.revert();
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      for (const clip of CLIPS) actions[clip]?.stop();
      return;
    }
    for (const clip of CLIPS) {
      const action = actions[clip];
      if (action && action !== actions[state]) {
        action.fadeOut(0.25);
      }
    }
    const target = actions[state] ?? actions.idle;
    if (target) {
      target.reset();
      target.fadeIn(0.25);
      target.play();
    }
    return () => {
      for (const clip of CLIPS) actions[clip]?.stop();
    };
  }, [state, actions, reduceMotion]);

  return <primitive object={scene} ref={group} />;
}

function ForkyScene({ state, onReady }: { state: ForkyState; onReady: () => void }) {
  const gltf = useGLTF(FORKY_MODEL_URL, false, true) as GLTFResult;

  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <>
      <ForkyModel state={state} gltf={gltf} />
      <ForkyCamera scene={gltf.scene} />
    </>
  );
}

function ForkyCamera({ scene }: { scene: THREE.Group }) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const bounds = new THREE.Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.5);
    const fov = THREE.MathUtils.degToRad(CAMERA_FOV);
    const tangent = Math.tan(fov / 2);
    const heightDistance = (dimensions.y * CAMERA_MARGIN * 0.5) / tangent;
    const widthDistance = (dimensions.x * CAMERA_MARGIN * 0.5) / (tangent * aspect);
    const distance = Math.max(heightDistance, widthDistance, dimensions.z * 2.2, 2.6);

    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);
    camera.near = 0.01;
    camera.far = Math.max(20, distance + dimensions.z * 8);
    camera.updateProjectionMatrix();
  }, [camera, scene, size.height, size.width]);

  return null;
}

function ForkyLoading() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div
        role="status"
        aria-live="polite"
        className="rounded-full border border-white/15 bg-[#110d1d]/80 px-3 py-1.5 text-[11px] text-white/75 shadow-lg backdrop-blur-md"
      >
        Cargando Forky {Math.round(progress)}%
      </div>
    </Html>
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Forky 3D viewer. SSR-safe: renders nothing until mounted (no three.js on the
 * server). The GLB carries the idle/greet/talk/think/happy clips; the current
 * `state` crossfades into the matching clip.
 */
export function Forky3DViewer({ state }: { state: ForkyState }) {
  const [mounted, setMounted] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Probe WebGL availability before mounting the Canvas: in environments
    // without a GPU (headless CI, VMs, strict privacy browsers) creating a
    // context can crash the renderer. Fall back to the 2D sprite.
    setWebglOk(hasWebGL());
  }, []);

  return (
    <div
      data-testid="forky-canvas"
      className="pointer-events-none h-full w-full overflow-visible"
      aria-busy={mounted && webglOk && !modelReady ? true : undefined}
    >
      {!webglOk || !modelReady ? (
        <img
          src="/assets/forky/forky-preview.png"
          alt="Forky"
          className="h-full max-h-[min(70vh,34rem)] w-auto object-contain drop-shadow-[0_18px_30px_rgba(124,92,255,0.35)]"
        />
      ) : null}
      {mounted && webglOk ? (
        <Canvas
          camera={{ position: [0, 0, 3], fov: CAMERA_FOV, near: 0.01, far: 20 }}
          dpr={[1, 1.25]}
          frameloop="always"
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 3, 2.5]} intensity={1.6} />
          <directionalLight position={[-2.5, 1.5, -2]} intensity={0.5} />
          <pointLight position={[0.5, 1.2, -0.8]} intensity={7} color="#ffe9c4" />
          <Suspense fallback={<ForkyLoading />}>
            <ForkyScene state={state} onReady={() => setModelReady(true)} />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}

export function preloadForkyModel(): void {
  useGLTF.preload(FORKY_MODEL_URL, false, true);
}
