import { describe, expect, it } from "vitest";
import {
  normalizeTableSize,
  previewGeometry,
  sumAssignmentSeats,
  normalizeAssignmentSeats,
  splitPartyAcrossTables,
  resolveAssignments,
  assignmentsDisplayName,
  seatedNamesForTable,
} from "./tables";

describe("normalizeTableSize / previewGeometry (editor resize)", () => {
  it("uses the capacity-based default when no explicit size is given", () => {
    const geom = previewGeometry("round", 4, { left: false, right: false });
    expect(geom.width).toBe(148 + 4 * 2);
    expect(geom.height).toBe(148 + 4 * 2);
  });

  it("applies an explicit size over the capacity default", () => {
    const geom = previewGeometry("round", 4, { left: false, right: false }, { width: 220, height: 220 });
    expect(geom.width).toBe(220);
    expect(geom.height).toBe(220);
    expect(geom.chairs.length).toBe(4);
  });

  it("rounds explicit sizes", () => {
    const size = normalizeTableSize("square", 8, { left: true, right: true }, { width: 200.6, height: 140.4 });
    expect(size).toEqual({ width: 201, height: 140 });
  });

  it("ignores invalid explicit sizes and falls back", () => {
    const size = normalizeTableSize("round", 6, { left: false, right: false }, { width: NaN, height: 0 });
    expect(size.width).toBe(148 + 6 * 2);
    expect(size.height).toBe(148 + 6 * 2);
  });

  it("places chairs around a rectangular resized table", () => {
    const geom = previewGeometry("square", 8, { left: true, right: true }, { width: 260, height: 160 });
    expect(geom.width).toBe(260);
    expect(geom.height).toBe(160);
    expect(geom.chairs.length).toBe(8);
    // All chairs should sit near the table (bounded by size + offset).
    for (const chair of geom.chairs) {
      expect(Math.abs(chair.x)).toBeLessThan(260 / 2 + 40);
      expect(Math.abs(chair.y)).toBeLessThan(160 / 2 + 40);
    }
  });
});

describe("assignment helpers (multi-table booking)", () => {
  const rows = (seats: number[]) => seats.map((s) => ({ table_id: 1, table_name: "Mesa 1", seats: s, names: [] as string[] }));

  it("sumAssignmentSeats adds seats", () => {
    expect(sumAssignmentSeats(rows([2, 3, 1]))).toBe(6);
    expect(sumAssignmentSeats(undefined)).toBe(0);
  });

  it("normalizeAssignmentSeats keeps the total equal to the party size", () => {
    const next = normalizeAssignmentSeats(rows([4, 2]), 5) as Array<{ seats: number }>;
    expect(next.reduce((a, r) => a + r.seats, 0)).toBe(5);
  });

  it("normalizeAssignmentSeats rebalances when adding a table", () => {
    const next = normalizeAssignmentSeats(rows([4, 2, 1]), 6) as Array<{ seats: number }>;
    expect(next.reduce((a, r) => a + r.seats, 0)).toBe(6);
    expect(next.every((r) => r.seats >= 1)).toBe(true);
  });

  it("splitPartyAcrossTables distributes the party evenly", () => {
    const tables = [
      { table_id: 5, table_name: "Mesa 5" },
      { table_id: 7, table_name: "Mesa 7" },
    ];
    const split = splitPartyAcrossTables(5, tables);
    expect(split.reduce((a, r) => a + r.seats, 0)).toBe(5);
    expect(split.map((r) => r.seats).sort((a, b) => b - a)).toEqual([3, 2]);
    expect(split[0].table_name).toBe("Mesa 5");
  });

  it("resolveAssignments prefers structured assignments", () => {
    const state = {
      seated: true,
      assignments: [{ table_id: 5, table_name: "Mesa 5", seats: 2, names: ["Ana"] }],
    };
    const resolved = resolveAssignments(state, "Mesa 5", 4);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].seats).toBe(2);
  });

  it("resolveAssignments derives a legacy single-table assignment", () => {
    const resolved = resolveAssignments(undefined, "Mesa 3", 4);
    expect(resolved).toEqual([{ table_id: null, table_name: "Mesa 3", seats: 4, names: [] }]);
  });

  it("resolveAssignments returns empty for unassigned bookings", () => {
    expect(resolveAssignments(undefined, null, 4)).toEqual([]);
  });

  it("assignmentsDisplayName joins tables", () => {
    expect(assignmentsDisplayName([{ table_name: "Mesa 1" }, { table_name: "Mesa 2" }], "")).toBe("Mesa 1 + Mesa 2");
    expect(assignmentsDisplayName([], "Mesa 9")).toBe("Mesa 9");
  });

  it("seatedNamesForTable gathers names for the matching table only", () => {
    const assignments = [
      { table_name: "Mesa 1", names: ["Ana", "Luis"] },
      { table_name: "Mesa 2", names: ["Paz"] },
    ];
    expect(seatedNamesForTable(assignments, "Mesa 1")).toEqual(["Ana", "Luis"]);
    expect(seatedNamesForTable(assignments, "Mesa 2")).toEqual(["Paz"]);
    expect(seatedNamesForTable(assignments, "Mesa 3")).toEqual([]);
  });
});
