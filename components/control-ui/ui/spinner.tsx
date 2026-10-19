// control-ui.dev r/spinner — src/registry/sources/control-ui/ui/spinner.tsx (owned source;
// the registry's `@/components/control-ui/…` imports are rewritten to relative paths).
import { Loader2 } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";
import type { ControlSize } from "../control-variants";
import type { SpinnerKnobStyle } from "../knob-contracts/spinner-knobs";
import { cn } from "../lib/cn";

export type SpinnerProps = Omit<
  ComponentProps<"span"> & {
    size?: ControlSize;
    label?: string;
  },
  "style" | "children"
> & { style?: CSSProperties & SpinnerKnobStyle };

export function Spinner({ size = "sm", label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      data-control-ui="spinner"
      data-control-family="spinner"
      data-slot="root"
      data-motion-essential=""
      className={cn("inline-flex", className)}
      {...props}
    >
      <Loader2 aria-hidden="true" data-control-ui="spinner" data-control-family="spinner" data-slot="indicator" data-size={size} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
