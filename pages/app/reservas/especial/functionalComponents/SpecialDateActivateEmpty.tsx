import React from "react";
import { Sparkles } from "lucide-react";

/**
 * Empty state for a day that is NOT a special-menu day yet.
 *
 * Layout (mobile-first, everything centred in a single column):
 *
 *   ┌──────────────────────────────┐
 *   │        Sin menu especial     │   <- status line
 *   │                              │
 *   │     Activar menu especial    │   <- prompt
 *   │          [ Activar ]         │   <- CTA
 *   └──────────────────────────────┘
 *
 * Pressing "Activar" flips the day to a special-menu day through the
 * socket-backed save endpoint; the parent swaps this block for the tabs
 * optimistically, so this component stays presentational (SRP).
 *
 * Coordination id: especial_activate_v1
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
      className="grid justify-items-center gap-5 py-2 text-center"
      data-testid="especial-activate-empty"
    >
      <div className="grid justify-items-center gap-2" data-testid="especial-activate-empty-status">
        <Sparkles
          size={20}
          strokeWidth={1.6}
          className="text-(--bo-muted)"
          aria-hidden="true"
          data-testid="especial-activate-empty-icon"
        />
        <p
          className="text-center text-base font-medium text-(--bo-text)"
          data-testid="especial-activate-empty-title"
        >
          Sin menu especial
        </p>
      </div>

      {/* Prompt + CTA stacked in their own column, per spec. */}
      <div
        className="flex w-full flex-col items-center gap-3"
        data-testid="especial-activate-empty-cta-group"
      >
        <p
          className="text-center text-sm text-(--bo-muted)"
          data-testid="especial-activate-empty-cta-label"
        >
          Activar menu especial
        </p>
        <button
          type="button"
          onClick={onActivate}
          disabled={activating}
          aria-busy={activating}
          className="bo-btn bo-btn--primary w-full max-w-[280px] justify-center transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60 motion-reduce:transition-none"
          data-testid="especial-activate-empty-btn"
        >
          {activating ? "Activando…" : "Activar"}
        </button>
      </div>
    </div>
  );
}
