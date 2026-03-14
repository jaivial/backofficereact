import React from "react";

import { phoneCodeOptions } from "../lib/phone";
import { Select } from "./Select";

export function PhoneInput({
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  disabled,
  countryAriaLabel = "Prefijo",
  numberAriaLabel = "Telefono",
}: {
  countryCode: string;
  number: string;
  onCountryCodeChange: (next: string) => void;
  onNumberChange: (next: string) => void;
  disabled?: boolean;
  countryAriaLabel?: string;
  numberAriaLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      <Select
        className="w-20"
        value={countryCode || "34"}
        onChange={onCountryCodeChange}
        ariaLabel={countryAriaLabel}
        options={phoneCodeOptions}
        disabled={disabled}
      />
      <input
        className="h-10 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-foreground outline-none transition-colors duration-150 focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)] disabled:opacity-50 disabled:cursor-not-allowed"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        aria-label={numberAriaLabel}
        disabled={disabled}
      />
    </div>
  );
}
