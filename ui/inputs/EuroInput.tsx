import React from "react";

import { cn } from "../shadcn/utils";

type EuroInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  "data-testid"?: string;
};

/**
 * Numeric money input with a fixed, non-editable € symbol inside the field.
 * Shared by every amount in the special-date form (menu price, per-menu
 * adelanto, unified adelanto).
 *
 * Observation point: `ui.euro_input.render`
 */
export function EuroInput({
  className,
  wrapperClassName,
  wrapperStyle,
  "data-testid": dataTestId,
  ...rest
}: EuroInputProps) {
  return (
    <div className={cn("relative w-full", wrapperClassName)} style={wrapperStyle} data-slot="euro-input-wrap">
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        className={cn("bo-input w-full pr-8", className)}
        data-testid={dataTestId}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-bo-muted"
        aria-hidden="true"
        data-testid={dataTestId ? `${dataTestId}-euro` : undefined}
      >
        €
      </span>
    </div>
  );
}
