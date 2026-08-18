import { describe, expect, it } from "vitest";

import type { ConfigSalon } from "../../../../../api/types";
import { mergeSalonOverrides, salonDayLabel } from "./salonDayHelpers";

const baseSalons: ConfigSalon[] = [
  { id: 1, floorId: 10, floorNumber: 0, floorName: "Planta baja", name: "Terraza", hasCapacityLimit: true, capacityLimit: 45, isActive: true, displayOrder: 0 },
  { id: 2, floorId: 11, floorNumber: 1, floorName: "Planta 1", name: "Privado", hasCapacityLimit: false, capacityLimit: 45, isActive: false, displayOrder: 0 },
];

describe("mergeSalonOverrides", () => {
  it("day override wins over global default, others untouched", () => {
    const merged = mergeSalonOverrides(baseSalons, { 1: false });
    expect(merged.find((s) => s.id === 1)?.isActive).toBe(false);
    expect(merged.find((s) => s.id === 2)?.isActive).toBe(false);
  });

  it("missing override keeps default active", () => {
    const merged = mergeSalonOverrides(baseSalons, { 2: true });
    expect(merged.find((s) => s.id === 2)?.isActive).toBe(true);
    expect(merged.find((s) => s.id === 1)?.isActive).toBe(true);
  });

  it("returns a new array (immutable) and does not mutate input", () => {
    const merged = mergeSalonOverrides(baseSalons, { 1: true });
    expect(merged).not.toBe(baseSalons);
    expect(baseSalons[0].isActive).toBe(true);
  });
});

describe("salonDayLabel", () => {
  it("labels overridden vs default state", () => {
    expect(salonDayLabel(baseSalons[0], true)).toBe("Activo (por defecto)");
    expect(salonDayLabel(baseSalons[1], false)).toBe("Inactivo (por defecto)");
    expect(salonDayLabel(baseSalons[0], false)).toBe("Cerrado hoy");
    expect(salonDayLabel(baseSalons[1], true)).toBe("Abierto hoy (override)");
  });
});
