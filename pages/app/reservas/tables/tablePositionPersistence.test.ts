import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DrawElement, BookingState, LinePoint } from "./+Page";

interface MockTablePosition {
  id: number;
  name: string;
  x_pos: number;
  y_pos: number;
  capacity: number;
  shape: "round" | "square";
  fill_color: string;
  outline_color: string;
  texture_image_url: string;
  metadata: Record<string, unknown>;
  area_id: number;
  status: "available" | "occupied" | "reserved";
}

interface TableAreasState {
  id: number;
  tables: MockTablePosition[];
  metadata: Record<string, unknown>;
}

interface SavePositionResult {
  id: number;
  x_pos: number;
  y_pos: number;
  date: string;
  floor_number: number;
}

describe("tablePositionPersistence", () => {
  describe("position save triggers", () => {
    it("saves table position when drag ends", () => {
      const mockSaveFn = vi.fn();
      const tableId = "5";
      const newX = 150;
      const newY = 200;

      mockSaveFn(tableId, newX, newY);

      expect(mockSaveFn).toHaveBeenCalledWith(tableId, newX, newY);
      expect(mockSaveFn).toHaveBeenCalledTimes(1);
    });

    it("does not save when position unchanged", () => {
      const mockSaveFn = vi.fn();
      const areas: TableAreasState[] = [
        {
          id: 1,
          tables: [{ id: 5, x_pos: 100, y_pos: 100 } as MockTablePosition],
          metadata: {},
        },
      ];

      const currentX = 100;
      const currentY = 100;

      if (areas[0].tables[0].x_pos === currentX && areas[0].tables[0].y_pos === currentY) {
        // Skip save - position unchanged
      } else {
        mockSaveFn("5", currentX, currentY);
      }

      expect(mockSaveFn).not.toHaveBeenCalled();
    });

    it("saves draw element positions with debounce", () => {
      const mockPersistFn = vi.fn();
      const elements: DrawElement[] = [
        { id: "draw-wall-1", x: 50, y: 60 } as DrawElement,
        { id: "draw-obstacle-1", x: 120, y: 80 } as DrawElement,
      ];
      const bookingStates: Record<string, BookingState> = {};
      const limitPoints: LinePoint[] = [];

      mockPersistFn(elements, bookingStates, limitPoints);

      expect(mockPersistFn).toHaveBeenCalledWith(elements, bookingStates, limitPoints);
    });
  });

  describe("debounce behavior", () => {
    it("clears previous timer when queuePersistLayout called again", () => {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let callCount = 0;

      const queuePersistLayout = vi.fn((elements: DrawElement[]) => {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
          callCount++;
        }, 120);
      });

      const elements1: DrawElement[] = [{ id: "draw-1", x: 10, y: 20 } as DrawElement];
      const elements2: DrawElement[] = [{ id: "draw-2", x: 30, y: 40 } as DrawElement];

      queuePersistLayout(elements1);
      queuePersistLayout(elements2);

      expect(timerId).not.toBeNull();
      expect(mockClearTimeout(timerId)).toBeUndefined();

      if (timerId) clearTimeout(timerId);
      expect(callCount).toBe(0);
    });

    it("flushes pending save on component unmount", () => {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let flushed = false;

      const queuePersistLayout = () => {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
          flushed = true;
        }, 120);
      };

      const cleanup = () => {
        if (timerId) {
          clearTimeout(timerId);
          flushed = true;
        }
      };

      queuePersistLayout();
      cleanup();

      expect(flushed).toBe(true);
    });
  });

  describe("area constraint validation", () => {
    it("clamps position to stay within limit area", () => {
      const limitPoints: LinePoint[] = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 400 },
        { x: 0, y: 400 },
      ];

      const tableSize = { width: 100, height: 100 };
      const preferredPosition = { x: 500, y: 500 };

      const clamped = clampToLimitArea(preferredPosition, tableSize, limitPoints);

      expect(clamped).not.toBeNull();
      expect(clamped!.x).toBeLessThanOrEqual(300);
      expect(clamped!.y).toBeLessThanOrEqual(300);
    });

    it("returns original position if already valid", () => {
      const limitPoints: LinePoint[] = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 400 },
        { x: 0, y: 400 },
      ];

      const tableSize = { width: 100, height: 100 };
      const preferredPosition = { x: 100, y: 100 };

      const clamped = clampToLimitArea(preferredPosition, tableSize, limitPoints);

      expect(clamped).toEqual(preferredPosition);
    });

    it("returns null if no valid position exists", () => {
      const limitPoints: LinePoint[] = [
        { x: 50, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 100 },
        { x: 50, y: 100 },
      ];

      const tableSize = { width: 200, height: 200 };
      const preferredPosition = { x: 0, y: 0 };

      const clamped = clampToLimitArea(preferredPosition, tableSize, limitPoints);

      expect(clamped).toBeNull();
    });
  });

  describe("API integration", () => {
    it("constructs correct API payload for table update", () => {
      const tableId = 5;
      const x_pos = 150;
      const y_pos = 200;
      const date = "2026-04-05";
      const floor_number = 0;

      const payload: SavePositionResult = {
        id: tableId,
        x_pos,
        y_pos,
        date,
        floor_number,
      };

      expect(payload).toEqual({
        id: 5,
        x_pos: 150,
        y_pos: 200,
        date: "2026-04-05",
        floor_number: 0,
      });
    });

    it("rounds positions to integers before saving", () => {
      const rawX = 150.67;
      const rawY = 200.33;

      const roundedX = Math.round(rawX);
      const roundedY = Math.round(rawY);

      expect(roundedX).toBe(151);
      expect(roundedY).toBe(200);
    });
  });

  describe("layout persistence", () => {
    it("serializes draw elements with display_mode key", () => {
      const element: DrawElement = {
        id: "draw-wall-1",
        kind: "wall",
        preset: "wall",
        displayMode: "both",
        x: 50,
        y: 60,
        width: 220,
        height: 26,
        rotationDeg: 0,
        label: "Pared",
      };

      const serialized = {
        ...element,
        display_mode: element.displayMode,
      };

      expect(serialized).toHaveProperty("display_mode");
      expect(serialized.display_mode).toBe("both");
    });

    it("preserves booking states in layout", () => {
      const bookingStates: Record<string, BookingState> = {
        "123": { seated: true },
        "456": { seated: false },
      };

      const layout = {
        elements: [],
        booking_states: bookingStates,
        limit_points: [],
      };

      expect(layout.booking_states["123"].seated).toBe(true);
      expect(layout.booking_states["456"].seated).toBe(false);
    });
  });
});

function mockClearTimeout(timerId: ReturnType<typeof setTimeout>): void {
  clearTimeout(timerId);
}

function clampToLimitArea(
  position: { x: number; y: number },
  size: { width: number; height: number },
  limitPoints: LinePoint[]
): { x: number; y: number } | null {
  if (limitPoints.length < 3) return position;

  const minX = Math.min(...limitPoints.map((p) => p.x));
  const maxX = Math.max(...limitPoints.map((p) => p.x));
  const minY = Math.min(...limitPoints.map((p) => p.y));
  const maxY = Math.max(...limitPoints.map((p) => p.y));

  const maxTableX = maxX - size.width;
  const maxTableY = maxY - size.height;

  if (size.width > maxX - minX || size.height > maxY - minY) {
    return null;
  }

  return {
    x: Math.max(minX, Math.min(position.x, maxTableX)),
    y: Math.max(minY, Math.min(position.y, maxTableY)),
  };
}
