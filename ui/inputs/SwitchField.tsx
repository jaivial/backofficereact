import React from "react";
import { cn } from "../shadcn/utils";

/**
 * Reusable labelled boolean switch built on the shared `.bo-sc-switch` styles.
 * Single control for every on/off setting so behaviour and markup stay in one place.
 */
export function SwitchField({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  "data-testid": dataTestId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  "data-testid": string;
}) {
  return (
    <div className={cn("bo-field", className)} data-slot="switch-field" data-testid={`${dataTestId}-field`}>
      <label className="bo-switchRow" data-slot="switch-field-row">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn("bo-sc-switch", checked && "is-checked")}
          data-state={checked ? "checked" : "unchecked"}
          data-testid={dataTestId}
        >
          <span className="bo-sc-switchThumb" data-state={checked ? "checked" : "unchecked"} data-slot="switch-field-thumb" />
        </button>
        <span className="bo-label" data-slot="switch-field-label">
          {label}
        </span>
      </label>
      {description ? (
        <p className="bo-mutedText" data-slot="switch-field-hint" data-testid={`${dataTestId}-hint`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
