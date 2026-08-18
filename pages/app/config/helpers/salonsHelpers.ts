import type { ConfigFloor, ConfigSalon } from "../../../../api/types";

export const DEFAULT_SALON_CAPACITY = 45;

export interface SalonFloorGroup {
  floor: ConfigFloor;
  salons: ConfigSalon[];
}

export function groupSalonsByFloor(floors: ConfigFloor[], salons: ConfigSalon[]): SalonFloorGroup[] {
  const byFloor = new Map<number, ConfigSalon[]>();
  for (const salon of salons) {
    const bucket = byFloor.get(salon.floorNumber);
    if (bucket) {
      bucket.push(salon);
    } else {
      byFloor.set(salon.floorNumber, [salon]);
    }
  }
  return [...floors]
    .sort((a, b) => a.floorNumber - b.floorNumber)
    .map((floor) => ({ floor, salons: byFloor.get(floor.floorNumber) ?? [] }));
}

export interface SalonDraft {
  floorNumber: number;
  name: string;
  hasCapacityLimit: boolean;
  capacityLimit: number;
}

export function newSalonDraft(floorNumber: number): SalonDraft {
  return {
    floorNumber,
    name: "",
    hasCapacityLimit: false,
    capacityLimit: DEFAULT_SALON_CAPACITY,
  };
}

export function salonCapacityText(salon: Pick<ConfigSalon, "hasCapacityLimit" | "capacityLimit">): string {
  return salon.hasCapacityLimit ? `Aforo ${salon.capacityLimit} personas` : "Sin límite de aforo";
}

/** Optimistic list update: replace/insert a salon, or remove by id. */
export function applySalonPatch(salons: ConfigSalon[], patched: ConfigSalon | null, removedId?: number): ConfigSalon[] {
  if (patched === null && removedId !== undefined) {
    return salons.filter((s) => s.id !== removedId);
  }
  if (patched === null) return salons;
  const idx = salons.findIndex((s) => s.id === patched.id);
  if (idx === -1) return [...salons, patched];
  const next = [...salons];
  next[idx] = patched;
  return next;
}
