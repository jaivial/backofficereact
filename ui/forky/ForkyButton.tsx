import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSetAtom } from "jotai";

import { forkyOpenAtom } from "../../state/atoms";

/**
 * Floating Forky button, bottom-right of every backoffice screen. Opens the
 * full-viewport assistant modal. Uses GSAP for the subtle idle float.
 */
export function ForkyButton() {
  const setOpen = useSetAtom(forkyOpenAtom);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!button || reducedMotion) return;
    const tween = gsap.to(button, { y: -5, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => { tween.kill(); };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid="forky-button"
      aria-label="Abrir asistente Forky"
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-[80] flex h-20 w-20 cursor-pointer items-end justify-center bg-transparent p-0 drop-shadow-[0_12px_26px_rgba(80,45,150,0.48)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-accent)]"
    >
      <img
        src="/assets/forky/forky-preview.png"
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    </button>
  );
}
