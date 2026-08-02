import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, type ThreeElements } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";

export type ForkyState = "idle" | "greet" | "talk" | "think" | "happy";

const FORKY_MODEL_URL = import.meta.env.VITE_FORKY_MODEL_URL || "/assets/forky/forky.glb";
const CLIPS = ["idle", "greet", "talk", "think", "happy"];

type GLTFResult = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

function ForkyModel({ state }: { state: ForkyState }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(FORKY_MODEL_URL, false, true) as GLTFResult;
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

/**
 * Forky 3D viewer. SSR-safe: renders nothing until mounted (no three.js on the
 * server). The GLB carries the idle/greet/talk/think/happy clips; the current
 * `state` crossfades into the matching clip.
 */
export function Forky3DViewer({ state }: { state: ForkyState }) {
  const [mounted, setMounted] = useState(false);
  const [webglOk, setWebglOk] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Probe WebGL availability before mounting the Canvas: in environments
    // without a GPU (headless CI, VMs, strict privacy browsers) creating a
    // context can crash the renderer. Fall back to the 2D sprite.
    let cancelled = false;
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ??
        canvas.getContext("webgl");
      if (!cancelled) setWebglOk(!!gl);
    } catch {
      if (!cancelled) setWebglOk(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-testid="forky-canvas" className="pointer-events-none h-full w-full overflow-visible">
      {mounted && !webglOk ? (
        <img
          src="/assets/forky/forky-preview.png"
          alt="Forky"
          className="h-full max-h-[min(70vh,34rem)] w-auto object-contain drop-shadow-[0_18px_30px_rgba(124,92,255,0.35)]"
        />
      ) : null}
      {mounted && webglOk ? (
        <Canvas
          camera={{ position: [0.55, -0.8, 0.45], fov: 38 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 3, 2.5]} intensity={1.6} />
          <directionalLight position={[-2.5, 1.5, -2]} intensity={0.5} />
          <pointLight position={[0.5, 1.2, -0.8]} intensity={12} color="#ffe9c4" />
          <ForkyModel state={state} />
        </Canvas>
      ) : null}
    </div>
  );
}

useGLTF.preload(FORKY_MODEL_URL, false, true);
