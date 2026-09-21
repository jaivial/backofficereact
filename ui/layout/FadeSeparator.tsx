import React from "react";
import { cn } from "../shadcn/utils";

/**
 * Horizontal rule whose line fades out towards BOTH ends, so sections read
 * as separated without a hard edge running into the container padding.
 *
 * The fade is a `linear-gradient` background rather than a masked border:
 * a border cannot be gradient-filled, and a mask would also erase any
 * child content. The element is a 1px-tall block, so the gradient IS the
 * line — transparent at 0% and 100%, solid in the middle.
 *
 * Decorative by default: it carries NO role and is `aria-hidden`, because a
 * run of purely visual rules should not add an announcement between every
 * field. Pairing `role="separator"` with `aria-hidden` would be
 * contradictory — the role adds the node to the a11y tree and aria-hidden
 * removes it — so the role is only applied when `decorative` is false.
 *
 * Reusable across the app — pass `className` for spacing, `tone` to pick
 * the line colour, and `testId` so each instance keeps a unique hook.
 */
export type FadeSeparatorTone = "default" | "strong";

const TONE_VAR: Record<FadeSeparatorTone, string> = {
  // --bo-border is a hairline (white .06 on dark); --bo-border-2 is the
  // slightly stronger variant used where the split must be obvious.
  default: "var(--bo-border)",
  strong: "var(--bo-border-2)",
};

export function FadeSeparator({
  tone = "default",
  decorative = true,
  className,
  testId = "fade-separator",
}: {
  tone?: FadeSeparatorTone;
  /** When false the separator is exposed to assistive tech as a real divider. */
  decorative?: boolean;
  className?: string;
  testId?: string;
}) {
  const color = TONE_VAR[tone];
  return (
    <div
      {...(decorative
        ? ({ "aria-hidden": true } as const)
        : ({ role: "separator", "aria-orientation": "horizontal" } as const))}
      data-ui="fade-separator"
      data-tone={tone}
      data-testid={testId}
      className={cn("h-px w-full shrink-0 border-0", className)}
      style={{
        backgroundImage: `linear-gradient(to right, transparent 0%, ${color} 18%, ${color} 82%, transparent 100%)`,
      }}
    />
  );
}
