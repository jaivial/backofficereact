import { memo } from "react";
import { Squishmoji, type SquishmojiProps } from "@usespaceui/squishmoji/react";

/**
 * Forky usa la librería de mascotas de MythCortex (`/custom-agents`):
 * las formas squishmoji (amebas, cuadrados, triángulos...) de
 * `@usespaceui/squishmoji`. Semilla fija para que Forky sea siempre el mismo.
 */

export type HermesState =
  | "breathing"
  | "working"
  | "composing"
  | "shaping"
  | "listening"
  | "solving";

const FORKY_SEED = "forky-villacarmen";

const STATE_EXPRESSION: Record<HermesState, SquishmojiProps["expression"]> = {
  breathing: "neutral",
  working: "determined",
  composing: "happy",
  shaping: "excited",
  listening: "attentive",
  solving: "curious",
};

export const ForkySquishMascot = memo(function ForkySquishMascot({
  state = "breathing",
  size = 64,
  testId,
}: {
  state?: HermesState;
  size?: number;
  testId?: string;
}) {
  return (
    <span data-testid={testId} style={{ display: "inline-flex", lineHeight: 0 }}>
      <Squishmoji
        seed={FORKY_SEED}
        shape="all"
        backgroundStyle="solid"
        expression={STATE_EXPRESSION[state]}
        size={size}
        animate
        animWobble
      />
    </span>
  );
});
