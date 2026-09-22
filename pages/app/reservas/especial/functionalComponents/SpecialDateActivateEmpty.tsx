import React from "react";

/**
 * Empty state for a day that is NOT a fecha festiva yet.
 *
 * Layout (mobile-first, everything centred in a single column):
 *
 *   ┌──────────────────────────────┐
 *   │       Sin fecha festiva      │   <- status line
 *   │          [ Activar ]         │   <- CTA (fit-content)
 *   └──────────────────────────────┘
 *
 * Pressing "Activar" flips the day to a fecha festiva through the
 * socket-backed save endpoint; the parent swaps this block for the tabs
 * optimistically, so this component stays presentational (SRP).
 *
 * Coordination id: especial_activate_v1
 * Observation point: `especial.activate_empty.render`
 */
export function SpecialDateActivateEmpty({
  onActivate,
  activating,
}: {
  onActivate: () => void;
  activating: boolean;
}) {
  return (
    <div
      className="grid justify-items-center gap-2 py-2 text-center"
      data-testid="especial-activate-empty"
    >
      <p
        className="text-center text-base font-medium text-bo-text"
        data-testid="especial-activate-empty-title"
      >
        Sin fecha festiva
      </p>

      <button
        type="button"
        onClick={onActivate}
        disabled={activating}
        aria-busy={activating}
        className="bo-btn bo-btn--primary w-fit transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60 motion-reduce:transition-none"
        data-testid="especial-activate-empty-btn"
      >
        {activating ? "Activando…" : "Activar"}
      </button>
    </div>
  );
}
