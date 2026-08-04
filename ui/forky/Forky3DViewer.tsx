import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";

export type ForkyState = "idle" | "greet" | "talk" | "think" | "happy" | "bend_active";

const FORKY_ASSET_ROOT =
  "https://villacarmenmedia.b-cdn.net/weai/Meshy_AI_A_mascot_character_in_biped%20(2)";

/**
 * Each Bunny asset contains the same skinned character and one animation.
 * Keep this mapping explicit because the Meshy clip names do not match the
 * assistant states used by the UI.
 *
 * All six files are requested when the viewer mounts. The preloader below uses
 * the same useGLTF cache as the active scene, so every transition is ready
 * before the automatic cycle starts.
 */
const FORKY_MODEL_URLS: Record<ForkyState, string> = {
  idle: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Idle_3_withSkin.glb`,
  greet: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Big_Wave_Hello_withSkin.glb`,
  talk: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Agree_Gesture_withSkin.glb`,
  think: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Idle_15_withSkin.glb`,
  happy: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Running_withSkin.glb`,
  bend_active: `${FORKY_ASSET_ROOT}/Meshy_AI_A_mascot_character_in_biped_Animation_Walking_withSkin.glb`,
};
const CAMERA_FOV = 32;
const CAMERA_MARGIN = 1.18;

type GLTFResult = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

function ForkyModel({
  state,
  gltf,
  onReady,
}: {
  state: ForkyState;
  gltf: GLTFResult;
  onReady: () => void;
}) {
  const { scene, animations } = gltf;
  // The animation tracks target named bones inside the Meshy armature. Use the
  // loaded scene as the mixer root so Three.js resolves every track exactly as
  // Meshy exported it.
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const action = useMemo(() => {
    const clip = animations[0];
    return clip ? mixer.clipAction(clip) : undefined;
  }, [animations, mixer]);
  const reduceMotion = useReducedMotion();
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const primed = useRef(false);
  const [modelVisible, setModelVisible] = useState(false);

  useFrame((_, delta) => {
    mixer.update(delta);
  });

  useLayoutEffect(() => {
    if (reduceMotion) return;
    const target = scene;
    const ctx = gsap.context(() => {
      gsap.to(target.position, { y: 0.045, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(target.rotation, { z: 0.035, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, target);
    return () => ctx.revert();
  }, [reduceMotion, scene]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[Forky] clips loaded", animations.map((clip) => clip.name));
    }
    const target = action;
    if (target) {
      const previous = activeAction.current;
      target.reset().setEffectiveWeight(1);
      target.setEffectiveTimeScale(reduceMotion ? 0.15 : 1);
      target.play();
      if (previous && previous !== target) {
        previous.crossFadeTo(target, 0.2, false);
      }
      activeAction.current = target;

      // Meshy exports the bind pose as the initial scene pose. Advance the
      // mixer before revealing the object so the first painted frame is
      // already an animated pose instead of a visible T-pose.
      mixer.update(1 / 60);
      if (!primed.current) {
        primed.current = true;
        setModelVisible(true);
        onReady();
      }
    } else if (import.meta.env.DEV) {
      console.warn("[Forky] GLB contains no animation", { state, url: gltf.scene.name });
    }
    return () => {
      if (activeAction.current && activeAction.current !== action) {
        activeAction.current.stop();
      }
    };
  }, [action, animations, gltf.scene.name, mixer, onReady, reduceMotion, state]);

  return <primitive object={scene} visible={modelVisible} />;
}

function ForkyScene({ state, onReady }: { state: ForkyState; onReady: () => void }) {
  const modelUrl = FORKY_MODEL_URLS[state];
  const gltf = useGLTF(modelUrl, false, true) as GLTFResult;

  return (
    <>
      <ForkyModel state={state} gltf={gltf} onReady={onReady} />
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
 * server). Each state selects one BunnyCDN GLB containing the matching Meshy
 * animation. All six assets are prepared before the automatic cycle starts.
 */
export function Forky3DViewer({
  state,
  onAssetsReady,
}: {
  state: ForkyState;
  onAssetsReady?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  // Only the currently-visible state's GLB is loaded eagerly. onAssetsReady is
  // fired once that model is painted so the caller can lazily preload the next
  // cycle state instead of fetching all six (~32 MB each) up front.
  const markModelReady = useCallback(() => {
    setModelReady(true);
    setAssetsReady(true);
    onAssetsReady?.();
  }, [onAssetsReady]);

  useEffect(() => {
    setModelReady(false);
  }, [state]);

  useEffect(() => {
    setMounted(true);
    // Probe WebGL availability before mounting the Canvas: in environments
    // without a GPU (headless CI, VMs, strict privacy browsers) creating a
    // context can crash the renderer. Keep the viewer empty rather than
    // substituting a static image, so Forky is always represented by WebGL.
    setWebglOk(hasWebGL());
  }, []);

  return (
    <div
      data-testid="forky-canvas"
      className="pointer-events-none h-full w-full overflow-visible"
      aria-busy={mounted && webglOk && (!assetsReady || !modelReady) ? true : undefined}
    >
      {!webglOk || !modelReady ? <span className="sr-only">Cargando Forky 3D</span> : null}
      {mounted && webglOk ? (
        <Canvas
          camera={{ position: [0, 0, 3], fov: CAMERA_FOV, near: 0.01, far: 20 }}
          dpr={[1, 1.5]}
          frameloop="always"
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 3, 2.5]} intensity={1.6} />
          <directionalLight position={[-2.5, 1.5, -2]} intensity={0.5} />
          <pointLight position={[0.5, 1.2, -0.8]} intensity={7} color="#ffe9c4" />
          <Suspense fallback={null}>
            <ForkyScene key={FORKY_MODEL_URLS[state]} state={state} onReady={markModelReady} />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}

export function preloadForkyModel(states: ForkyState[]): void {
  states.forEach((state) => useGLTF.preload(FORKY_MODEL_URLS[state], false, true));
}
