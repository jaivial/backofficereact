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
  initialDateFromSearch,
  isValidISODate,
  normalizeDateView,
  withDateParam,
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

describe("table map date helpers", () => {
  describe("isValidISODate", () => {
    it("accepts a well-formed YYYY-MM-DD date", () => {
      expect(isValidISODate("2026-04-05")).toBe(true);
    });

    it("accepts a real calendar date in any valid month/day range", () => {
      expect(isValidISODate("2024-02-29")).toBe(true); // leap year
      expect(isValidISODate("2026-12-31")).toBe(true);
      expect(isValidISODate("2026-01-01")).toBe(true);
    });

    it("rejects malformed formats", () => {
      expect(isValidISODate("05-04-2026")).toBe(false);
      expect(isValidISODate("2026/04/05")).toBe(false);
      expect(isValidISODate("2026-4-5")).toBe(false);
      expect(isValidISODate("foo")).toBe(false);
      expect(isValidISODate("")).toBe(false);
      expect(isValidISODate("2026-04-05T10:00:00Z")).toBe(false);
    });

    it("rejects impossible calendar dates", () => {
      expect(isValidISODate("2026-13-01")).toBe(false); // month 13
      expect(isValidISODate("2026-00-10")).toBe(false); // month 0
      expect(isValidISODate("2026-04-31")).toBe(false); // April has 30 days
      expect(isValidISODate("2026-02-30")).toBe(false); // Feb 30
      expect(isValidISODate("2025-02-29")).toBe(false); // not a leap year
      expect(isValidISODate("2026-04-00")).toBe(false); // day 0
    });

    it("rejects non-string values", () => {
      expect(isValidISODate(undefined)).toBe(false);
      expect(isValidISODate(null)).toBe(false);
      expect(isValidISODate(20260405 as unknown)).toBe(false);
      expect(isValidISODate(["2026-04-05"] as unknown)).toBe(false);
      expect(isValidISODate({ date: "2026-04-05" } as unknown)).toBe(false);
    });
  });

  describe("initialDateFromSearch", () => {
    it("returns the valid date from the search param", () => {
      expect(initialDateFromSearch("2026-04-05")).toBe("2026-04-05");
    });

    it("falls back to today when the search param is missing", () => {
      const fallback = initialDateFromSearch(undefined);
      expect(isValidISODate(fallback)).toBe(true);
    });

    it("falls back to today when the search param is empty", () => {
      const fallback = initialDateFromSearch("");
      expect(isValidISODate(fallback)).toBe(true);
    });

    it("falls back when the search param is not a valid ISO date", () => {
      const fallback = initialDateFromSearch("not-a-date");
      expect(isValidISODate(fallback)).toBe(true);
    });

    it("falls back when the search param is an impossible calendar date", () => {
      const fallback = initialDateFromSearch("2026-13-45");
      expect(isValidISODate(fallback)).toBe(true);
      expect(fallback).not.toBe("2026-13-45");
    });

    it("uses the provided fallback when the search param is invalid", () => {
      expect(initialDateFromSearch("bogus", "2026-01-01")).toBe("2026-01-01");
    });
  });

  describe("normalizeDateView", () => {
    it("builds a view from a valid ISO date", () => {
      expect(normalizeDateView("2026-04-05")).toEqual({ year: 2026, month: 4 });
    });

    it("falls back to the current month for garbage input", () => {
      const view = normalizeDateView("not-a-date");
      expect(Number.isFinite(view.year)).toBe(true);
      expect(view.month).toBeGreaterThanOrEqual(1);
      expect(view.month).toBeLessThanOrEqual(12);
    });
  });

  describe("withDateParam", () => {
    it("sets the date param on a URL without query params", () => {
      expect(withDateParam("https://app.test/app/reservas/tables", "2026-04-05")).toBe(
        "https://app.test/app/reservas/tables?date=2026-04-05",
      );
    });

    it("overwrites an existing date param", () => {
      expect(
        withDateParam("https://app.test/app/reservas/tables?date=2026-01-01", "2026-04-05"),
      ).toBe("https://app.test/app/reservas/tables?date=2026-04-05");
    });

    it("preserves other query params while changing the date", () => {
      const next = withDateParam("https://app.test/app/reservas/tables?floor=1&date=2026-01-01", "2026-04-05");
      expect(next).toContain("date=2026-04-05");
      expect(next).toContain("floor=1");
    });

    it("works with a relative URL", () => {
      expect(withDateParam("/app/reservas/tables", "2026-04-05")).toBe(
        "/app/reservas/tables?date=2026-04-05",
      );
    });
  });
});
