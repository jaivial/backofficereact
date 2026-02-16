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
    <div className="bo-phone">
      <Select
        className="bo-phoneCC"
        value={countryCode || "34"}
        onChange={onCountryCodeChange}
        ariaLabel={countryAriaLabel}
        options={phoneCodeOptions}
        disabled={disabled}
      />
      <input
        className="bo-input bo-phoneNum"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        aria-label={numberAriaLabel}
        disabled={disabled}
      />
    </div>
  );
}
