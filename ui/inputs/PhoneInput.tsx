import React from "react";
import { cn } from "../shadcn/utils";

import { phoneCodeOptions } from "../lib/phone";
import { Select } from "./Select";

export function PhoneInput({
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
  countryAriaLabel = "Prefijo",
  numberAriaLabel = "Telefono",
  className,
  testId,
}: {
  countryCode: string;
  number: string;
  onCountryCodeChange: (next: string) => void;
  onNumberChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Marks the number as invalid (error style + aria-invalid). */
  invalid?: boolean;
  /** id of the element describing the error. */
  describedBy?: string;
  countryAriaLabel?: string;
  numberAriaLabel?: string;
  className?: string;
  /** Unique data-testid of the number input; the prefix select gets `${testId}-cc`. */
  testId?: string;
}) {
  return (
    <div className={cn("bo-phone", className)} data-ui="phone-input">
      <Select
        className="bo-phoneCC"
        value={countryCode || "34"}
        onChange={onCountryCodeChange}
        ariaLabel={countryAriaLabel}
        options={phoneCodeOptions}
        disabled={disabled}
        data-testid={testId ? `${testId}-cc` : undefined}
      />
      <input
        className={cn("bo-input bo-phoneNum", invalid && "bo-input--error")}
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        onBlur={onBlur}
        aria-label={numberAriaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        data-testid={testId ?? "phone-input"}
      />
    </div>
  );
}
