import type { OpeningMode } from "../../../../../api/types";

export const openingModeOptions = [
  { value: "both", label: "Mañana + Noche" },
  { value: "morning", label: "Solo mañana" },
  { value: "night", label: "Solo noche" },
] as const satisfies readonly { value: OpeningMode; label: string }[];
