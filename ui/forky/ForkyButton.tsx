import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAtom, useAtomValue } from "jotai";
import { HermesMascot, type HermesState } from "./HermesMascot";

import { forkyOpenAtom, forkyHiddenAtom } from "../../state/atoms";
import {
  setForkyVisualState,
  useForkyVisualState,
  type ForkyVisualState,
} from "./forkyStatus";

export const FORKY_HIDDEN_KEY = "forky_hidden";

/** Map ForkyVisualState to Hermes mascot state (same names the old orb used). */
function mapVisualStateToHermesState(state: ForkyVisualState): HermesState {
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
  const [isMobile, setIsMobile] = useState(false);

  // Smaller, higher FAB on phones so it covers less of the content and
  // clears the bottom tab bar.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  const hermesState = mapVisualStateToHermesState(visualState);

  return (
    <div
      ref={containerRef}
      className="forky-floating-host fixed bottom-24 right-4 z-[110] sm:bottom-6 sm:right-6"
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
        {/* Hermes mascot */}
        <div data-slot="forkyButton-relative" className="relative">
          <HermesMascot state={hermesState} size={isMobile ? 44 : 64} testId="forky-canvas" />
        </div>
      </button>
    </div>
  );
}
