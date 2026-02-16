import React from "react";
import CountryFlag from "react-country-flag";

export type PhoneCodeOption = {
  value: string;
  label: string;
  icon: React.ReactNode;
};

export const phoneCodeOptions: PhoneCodeOption[] = [
  { value: "34", label: "+34 ES", icon: <CountryFlag countryCode="ES" svg aria-label="Espana" /> },
  { value: "33", label: "+33 FR", icon: <CountryFlag countryCode="FR" svg aria-label="Francia" /> },
  { value: "39", label: "+39 IT", icon: <CountryFlag countryCode="IT" svg aria-label="Italia" /> },
  { value: "44", label: "+44 UK", icon: <CountryFlag countryCode="GB" svg aria-label="Reino Unido" /> },
  { value: "49", label: "+49 DE", icon: <CountryFlag countryCode="DE" svg aria-label="Alemania" /> },
  { value: "351", label: "+351 PT", icon: <CountryFlag countryCode="PT" svg aria-label="Portugal" /> },
  { value: "1", label: "+1 US", icon: <CountryFlag countryCode="US" svg aria-label="Estados Unidos" /> },
];

const knownCodesByLenDesc = [...phoneCodeOptions.map((o) => o.value)].sort((a, b) => b.length - a.length);

function onlyDigits(s: string | null | undefined): string {
  return String(s || "").replace(/[^0-9]/g, "");
}

export function splitStoredPhone(rawPhone: string | null | undefined, fallbackCC = "34"): { countryCode: string; national: string } {
  const digits = onlyDigits(rawPhone);
  if (!digits) return { countryCode: fallbackCC, national: "" };

  for (const cc of knownCodesByLenDesc) {
    if (!digits.startsWith(cc)) continue;
    const national = digits.slice(cc.length);
    if (national.length >= 6 && national.length <= 14) return { countryCode: cc, national };
  }

  if (digits.startsWith(fallbackCC) && digits.length > fallbackCC.length + 5) {
    return { countryCode: fallbackCC, national: digits.slice(fallbackCC.length) };
  }

  return { countryCode: fallbackCC, national: digits };
}

export function composePhoneE164(countryCodeRaw: string, nationalRaw: string): string | null {
  const cc = onlyDigits(countryCodeRaw) || "34";
  const national = onlyDigits(nationalRaw);
  if (!national) return null;
  if (cc.length < 1 || cc.length > 4) return null;
  if (national.length < 6 || national.length > 15) return null;
  if (cc.length+national.length > 15) return null;
  return `+${cc}${national}`;
}
