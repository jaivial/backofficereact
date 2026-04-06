import type { WeekdayOpen } from "../../../../api/types";
import type { WeekdayCard } from "../helpers/configHelpers";

export type { WeekdayCard };

export type ContentTab = "restaurante" | "contacto" | "booking";

export const openingModeOptions = [
  { value: "both", label: "Mañana + Noche" },
  { value: "morning", label: "Solo mañana" },
  { value: "night", label: "Solo noche" },
] as const;

export const weekdayCards: WeekdayCard[] = [
  { key: "monday", label: "Lunes", shortLabel: "L" },
  { key: "tuesday", label: "Martes", shortLabel: "M" },
  { key: "wednesday", label: "Miércoles", shortLabel: "X" },
  { key: "thursday", label: "Jueves", shortLabel: "J" },
  { key: "friday", label: "Viernes", shortLabel: "V" },
  { key: "saturday", label: "Sábado", shortLabel: "S" },
  { key: "sunday", label: "Domingo", shortLabel: "D" },
];

export const clasificacionOptions = [
  { value: "sociedad", label: "Sociedad" },
  { value: "persona_fisica", label: "Persona física" },
];
