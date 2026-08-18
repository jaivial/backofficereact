import type { ConfigSalon } from "../../../../../api/types";

/** Effective per-day active state per salon id; missing = use global default. */
export type SalonDayOverrides = Record<number, boolean>;

/** Apply day overrides on top of the salons' global defaults. */
export function mergeSalonOverrides(salons: ConfigSalon[], overrides: SalonDayOverrides): ConfigSalon[] {
  return salons.map((salon) => {
    const overridden = overrides[salon.id];
    if (overridden === undefined || overridden === salon.isActive) return salon;
    return { ...salon, isActive: overridden };
  });
}

export function salonDayLabel(salon: ConfigSalon, effectiveActive: boolean): string {
  const isDefault = salon.isActive === effectiveActive;
  if (isDefault) return effectiveActive ? "Activo (por defecto)" : "Inactivo (por defecto)";
  return effectiveActive ? "Abierto hoy (override)" : "Cerrado hoy";
}
