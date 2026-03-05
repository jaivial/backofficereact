import { describe, expect, it } from "vitest";

import {
  areaMetadata,
  floorNumberForArea,
  limitAreaTemplatePointsForFloor,
  normalizeTableArea,
} from "./areaLayout";

describe("areaLayout helpers", () => {
  it("resolves metadata from both metadata and metadata_json", () => {
    expect(areaMetadata({ metadata: { floorNumber: 2 } } as any)).toEqual({ floorNumber: 2 });
    expect(areaMetadata({ metadata_json: { floorNumber: 3 } } as any)).toEqual({ floorNumber: 3 });
    expect(areaMetadata(null)).toEqual({});
  });

  it("normalizes areas and floor numbers", () => {
    const normalized = normalizeTableArea({ id: 1, metadata_json: { floorNumber: 4 } });
    expect(normalized.metadata).toEqual({ floorNumber: 4 });
    expect(normalized.tables).toEqual([]);
    expect(floorNumberForArea(normalized)).toBe(4);
  });

  it("extracts template points for the selected floor", () => {
    const points = limitAreaTemplatePointsForFloor(
      [
        {
          id: 1,
          restaurant_id: 1,
          name: "Salón 1",
          metadata: {
            floorNumber: 1,
            limit_area_template_points: [
              { x: 10, y: 10 },
              { x: 90, y: 10 },
              { x: 90, y: 90 },
            ],
          },
          tables: [],
        } as any,
      ],
      1,
    );

    expect(points).toEqual([
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
    ]);
  });
});
