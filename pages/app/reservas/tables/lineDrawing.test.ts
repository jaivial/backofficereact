import { describe, expect, it } from "vitest";

import { projectFlowPointToOverlay } from "./lineDrawing";

describe("projectFlowPointToOverlay", () => {
  it("maps a flow point into overlay coordinates using viewport transform", () => {
    const point = { x: 120, y: 80 };
    const viewport = { x: 34, y: 12, zoom: 0.5 };

    expect(projectFlowPointToOverlay(point, viewport)).toEqual({
      x: 94,
      y: 52,
    });
  });

  it("supports negative viewport translation", () => {
    const point = { x: 200, y: 140 };
    const viewport = { x: -100, y: -40, zoom: 1.25 };

    expect(projectFlowPointToOverlay(point, viewport)).toEqual({
      x: 150,
      y: 135,
    });
  });
});
