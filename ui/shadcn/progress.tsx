import React from "react";

import { cn } from "./utils";

export function Progress({ className, value = 0 }: { className?: string; value?: number }) {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className="h-full bg-primary transition-all" style={{ width: `${bounded}%` }} />
    </div>
  );
}
