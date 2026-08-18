import { describe, expect, it } from "vitest";

import type { ConfigFloor, ConfigSalon } from "../../../../api/types";
import { applySalonPatch, groupSalonsByFloor, newSalonDraft, salonCapacityText } from "./salonsHelpers";

const floors: ConfigFloor[] = [
  { id: 10, floorNumber: 0, name: "Planta baja", isGround: true, active: true },
  { id: 11, floorNumber: 1, name: "Planta 1", isGround: false, active: true },
];

const salons: ConfigSalon[] = [
  { id: 1, floorId: 10, floorNumber: 0, floorName: "Planta baja", name: "Terraza", hasCapacityLimit: true, capacityLimit: 45, isActive: true, displayOrder: 0 },
  { id: 2, floorId: 11, floorNumber: 1, floorName: "Planta 1", name: "Privado", hasCapacityLimit: false, capacityLimit: 45, isActive: true, displayOrder: 0 },
];

describe("groupSalonsByFloor", () => {
  it("nests salons inside their floor, keeping floors without salons", () => {
    const groups = groupSalonsByFloor(floors, salons);
    expect(groups).toHaveLength(2);
    expect(groups[0].floor.floorNumber).toBe(0);
    expect(groups[0].salons.map((s) => s.name)).toEqual(["Terraza"]);
    expect(groups[1].salons.map((s) => s.name)).toEqual(["Privado"]);
  });

  it("orders groups by floor number", () => {
    const reversed = [...floors].reverse();
    const groups = groupSalonsByFloor(reversed, salons);
    expect(groups[0].floor.floorNumber).toBe(0);
  });

  it("orphan salons (floor deleted race) are dropped, not crashed on", () => {
    const orphan = { ...salons[0], floorId: 999, floorNumber: 9 };
    const groups = groupSalonsByFloor(floors, [orphan]);
    expect(groups.flatMap((g) => g.salons)).toHaveLength(0);
  });
});

describe("newSalonDraft", () => {
  it("defaults to unlimited capacity with fallback limit of 45", () => {
    const draft = newSalonDraft(floors[0].floorNumber);
    expect(draft.floorNumber).toBe(0);
    expect(draft.name).toBe("");
    expect(draft.hasCapacityLimit).toBe(false);
    expect(draft.capacityLimit).toBe(45);
  });
});

describe("salonCapacityText", () => {
  it("describes unlimited and limited salons", () => {
    expect(salonCapacityText(salons[1])).toBe("Sin límite de aforo");
    expect(salonCapacityText(salons[0])).toBe("Aforo 45 personas");
  });
});

describe("applySalonPatch", () => {
  it("replaces or inserts a salon optimistically", () => {
    const next = applySalonPatch(salons, { ...salons[0], name: "Terraza VIP" });
    expect(next.find((s) => s.id === 1)?.name).toBe("Terraza VIP");
    const added = applySalonPatch(salons, {
      id: 3, floorId: 10, floorNumber: 0, floorName: "Planta baja", name: "Barra",
      hasCapacityLimit: false, capacityLimit: 45, isActive: true, displayOrder: 1,
    });
    expect(added).toHaveLength(3);
  });

  it("removes a salon by id", () => {
    expect(applySalonPatch(salons, null, 2)).toHaveLength(1);
  });
});
