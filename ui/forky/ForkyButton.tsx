import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAtom } from "jotai";

import { forkyOpenAtom } from "../../state/atoms";
import {
  setForkyVisualState,
  useForkyVisualState,
  type ForkyVisualState,
} from "./forkyStatus";

const FORKY_AUTO_CYCLE_INTERVAL_MS = 5_000;
const FORKY_AUTO_CYCLE_STATES: ForkyVisualState[] = [
  "idle",
  "greet",
  "talk",
  "think",
  "happy",
  "bend_active",
];

export function advanceForkyAutoCycle(currentIndex: number): number {
  const nextIndex = (currentIndex + 1) % FORKY_AUTO_CYCLE_STATES.length;
  setForkyVisualState(FORKY_AUTO_CYCLE_STATES[nextIndex]);
  return nextIndex;
}

function Forky3DViewerClient({
  state,
  onAssetsReady,
}: {
  state: import("./Forky3DViewer").ForkyState;
  onAssetsReady: () => void;
}) {
  const [Viewer, setViewer] = useState<
    typeof import("./Forky3DViewer").Forky3DViewer | null
  >(null);

  useEffect(() => {
    let active = true;
    void import("./Forky3DViewer").then(({ Forky3DViewer }) => {
      if (active) setViewer(() => Forky3DViewer);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!Viewer) return null;
  return <Viewer state={state} onAssetsReady={onAssetsReady} />;
}

function prefetchForkyModel(states: ForkyVisualState[]): void {
  void import("./Forky3DViewer")
    .then(({ preloadForkyModel }) => preloadForkyModel(states))
    .catch(() => {
      // WebGL remains the only visual representation. The viewer can retry
      // when it mounts or when the user focuses the button.
    });
}

/**
 * The auto-cycle advances through states deterministically. Return the current
 * state plus the one that will be shown next so callers can preload just the
 * pair instead of fetching all six GLBs (~32 MB each) up front.
 */
function currentAndNextCycleState(
  current: ForkyVisualState,
): [ForkyVisualState, ForkyVisualState] {
  const index = FORKY_AUTO_CYCLE_STATES.indexOf(current);
  const i = index >= 0 ? index : 0;
  return [FORKY_AUTO_CYCLE_STATES[i], FORKY_AUTO_CYCLE_STATES[(i + 1) % FORKY_AUTO_CYCLE_STATES.length]];
}

/**
 * Floating Forky button, bottom-right of every backoffice screen. Opens the
 * full-viewport assistant modal. Uses GSAP for the subtle idle float.
 */
export function ForkyButton() {
  const [open, setOpen] = useAtom(forkyOpenAtom);
  const visualState = useForkyVisualState();
  const [assetsReady, setAssetsReady] = useState(false);
  const visualStateRef = useRef(visualState);
  const cycleIndexRef = useRef(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleAssetsReady = useCallback(() => setAssetsReady(true), []);
  visualStateRef.current = visualState;

  // Lazy loading: fetch only the currently-visible GLB (needed to paint the
  // mascot) instead of all six (~32 MB each). Once it is ready, preload the
  // next cycle state so transitions stay smooth without an up-front ~190 MB
  // download on every backoffice page.
  useEffect(() => {
    prefetchForkyModel([currentAndNextCycleState(visualState)[0]]);
  }, [visualState]);

  useEffect(() => {
    if (!assetsReady) return;
    prefetchForkyModel([currentAndNextCycleState(visualState)[1]]);
  }, [assetsReady, visualState]);

  useEffect(() => {
    if (!open) return;
    setForkyVisualState("greet");
    const timer = window.setTimeout(() => setForkyVisualState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open || !assetsReady) {
      cycleIndexRef.current = -1;
      return;
    }

    const currentIndex = FORKY_AUTO_CYCLE_STATES.indexOf(visualStateRef.current);
    cycleIndexRef.current = currentIndex >= 0 ? currentIndex : 0;
    const timer = window.setInterval(() => {
      cycleIndexRef.current = advanceForkyAutoCycle(cycleIndexRef.current);
    }, FORKY_AUTO_CYCLE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [assetsReady, open]);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!button || reducedMotion) return;
    const tween = gsap.to(button, { y: -5, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => { tween.kill(); };
  }, []);

  return (
    <div
      className={`fixed bottom-6 z-[110] flex items-end justify-center overflow-visible transition-[right,width,height] duration-300 ${
        open
          ? "right-4 bottom-24 h-56 w-44 min-w-0 md:right-[calc(min(38rem,50vw)+1rem)] md:bottom-6 md:h-[min(58vh,34rem)] md:w-[min(34vw,24rem)] md:min-w-48"
          : "right-6 h-60 w-60"
      }`}
      data-testid="forky-floating-host"
    >
      <Forky3DViewerClient state={visualState} onAssetsReady={handleAssetsReady} />
      <button
        ref={buttonRef}
        type="button"
        data-testid="forky-button"
        aria-label={open ? "Forky está abierto" : "Abrir asistente Forky"}
        onClick={() => setOpen((current) => !current)}
        onPointerEnter={() => {
          prefetchForkyModel(currentAndNextCycleState(visualState));
          if (!open) setForkyVisualState("bend_active");
        }}
        onPointerLeave={() => {
          if (!open) setForkyVisualState("idle");
        }}
        onFocus={() => {
          prefetchForkyModel(currentAndNextCycleState(visualState));
          if (!open) setForkyVisualState("bend_active");
        }}
        className={`absolute cursor-pointer appearance-none rounded-none border-0 bg-transparent p-0 shadow-none transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-accent)] ${
          open ? "bottom-0 right-0 h-20 w-20" : "inset-0"
        }`}
        style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
      />
    </div>
  );
}
