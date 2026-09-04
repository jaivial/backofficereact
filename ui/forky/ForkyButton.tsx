import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { useAtom, useAtomValue } from "jotai";
import { ThinkingOrb, type OrbState } from "thinking-orbs";

import { forkyOpenAtom, forkyHiddenAtom } from "../../state/atoms";
import {
  setForkyVisualState,
  useForkyVisualState,
  type ForkyVisualState,
} from "./forkyStatus";

export const FORKY_HIDDEN_KEY = "forky_hidden";

/** Map ForkyVisualState to ThinkingOrb state */
function mapVisualStateToOrbState(state: ForkyVisualState): OrbState {
  switch (state) {
    case "think":
      return "working";
    case "talk":
      return "composing";
    case "greet":
    case "happy":
      return "shaping";
    case "bend_active":
      return "listening";
    case "idle":
    default:
      return "breathing";
  }
}

/** Read Forky hidden state from localStorage. */
export function readForkyHiddenFromStorage(): boolean {
  try {
    return localStorage.getItem(FORKY_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Floating Forky orb button, bottom-right of every backoffice screen.
 * Opens the full-viewport assistant modal. Uses GSAP for subtle idle float.
 * 
 * Visibility is controlled by the forkyHiddenAtom (toggled via ForkyToggle in the header).
 */
export function ForkyButton() {
  const [open, setOpen] = useAtom(forkyOpenAtom);
  const hidden = useAtomValue(forkyHiddenAtom);
  const visualState = useForkyVisualState();
  const containerRef = useRef<HTMLDivElement>(null);

  // Set greet state when modal opens
  useEffect(() => {
    if (!open) return;
    setForkyVisualState("greet");
    const timer = window.setTimeout(() => setForkyVisualState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Subtle floating animation
  useLayoutEffect(() => {
    const container = containerRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!container || reducedMotion || hidden) return;
    const tween = gsap.to(container, { y: -4, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => { tween.kill(); };
  }, [hidden]);

  // If hidden or modal is open, render nothing
  if (hidden || open) return null;

  const orbState = mapVisualStateToOrbState(visualState);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-[110]"
      data-testid="forky-floating-host"
    >
      <button
        type="button"
        data-testid="forky-button"
        aria-label="Abrir asistente Forky"
        onClick={() => setOpen(true)}
        onPointerEnter={() => setForkyVisualState("bend_active")}
        onPointerLeave={() => setForkyVisualState("idle")}
        onFocus={() => setForkyVisualState("bend_active")}
        className="group relative flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
      >
        {/* Glow effect - subtle white glow instead of purple */}
        <div data-slot="forkyButton-group-hover:bg-white/20" className="absolute -inset-2 rounded-full bg-white/10 blur-lg transition-opacity duration-300 group-hover:bg-white/20" />
        {/* Orb */}
        <div data-slot="forkyButton-relative" className="relative">
          <ThinkingOrb state={orbState} size={64} theme="dark" data-testid="forky-canvas" />
        </div>
      </button>
    </div>
  );
}
