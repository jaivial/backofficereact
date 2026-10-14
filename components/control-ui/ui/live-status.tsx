// control-ui.dev r/live-status — src/registry/sources/control-ui/ui/live-status.tsx (owned source;
// the registry's `@/components/control-ui/…` import is rewritten to a relative path).
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export type LiveStatusProps = Omit<ComponentProps<"span">, "role" | "children"> & { message: string };

export function LiveStatus({ message, className, ...props }: LiveStatusProps) {
  return (
    <span
      {...props}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-control-ui="live-status"
      data-slot="root"
      className={cn("sr-only", className)}
    >
      {message}
    </span>
  );
}
