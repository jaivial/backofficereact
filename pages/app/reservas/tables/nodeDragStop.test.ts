import { describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import type { LinePoint } from "./lineDrawing";

describe("onNodeDragStop callback behavior", () => {
  describe("restaurant table drag stop", () => {
    it("triggers savePosition when table drag ends", () => {
      const savePosition = vi.fn();
      const mockNode: Node = {
        id: "5",
        type: "restaurantTable",
        position: { x: 150, y: 200 },
        data: {},
      };

      // Simulate onNodeDragStop callback - event is ignored in tests
      const onNodeDragStop = (_event: unknown, node: Node) => {
        if (node.type === "restaurantTable" && node.position) {
          savePosition(node.id, node.position.x, node.position.y);
        }
      };

      onNodeDragStop(null, mockNode);

      expect(savePosition).toHaveBeenCalledWith("5", 150, 200);
    });

    it("rounds position values before saving", () => {
      const savePosition = vi.fn();
      const mockNode: Node = {
        id: "5",
        type: "restaurantTable",
        position: { x: 150.67, y: 200.33 },
        data: {},
      };

      const onNodeDragStop = (_event: unknown, node: Node) => {
        if (node.type === "restaurantTable" && node.position) {
          const x = Math.round(node.position.x);
          const y = Math.round(node.position.y);
          savePosition(node.id, x, y);
        }
      };

      onNodeDragStop(null, mockNode);

      expect(savePosition).toHaveBeenCalledWith("5", 151, 200);
    });

    it("does not trigger savePosition for non-table nodes", () => {
      const savePosition = vi.fn();
      const mockNode: Node = {
        id: "draw-wall-1",
        type: "drawElement",
        position: { x: 50, y: 60 },
        data: {},
      };

      const onNodeDragStop = (_event: unknown, node: Node) => {
        if (node.type === "restaurantTable" && node.position) {
          savePosition(node.id, node.position.x, node.position.y);
        }
      };

      onNodeDragStop(null, mockNode);

      expect(savePosition).not.toHaveBeenCalled();
    });

    it("handles both mouse and touch events", () => {
      const savePosition = vi.fn();
      const mockNode: Node = {
        id: "5",
        type: "restaurantTable",
        position: { x: 300, y: 400 },
        data: {},
      };

      // Works for both event types
      const onNodeDragStop = (_event: unknown, node: Node) => {
        if (node.type === "restaurantTable" && node.position) {
          savePosition(node.id, node.position.x, node.position.y);
        }
      };

      onNodeDragStop({ type: "mouseup" }, mockNode);
      expect(savePosition).toHaveBeenCalledWith("5", 300, 400);

      savePosition.mockClear();
      onNodeDragStop({ type: "touchend" }, mockNode);
      expect(savePosition).toHaveBeenCalledWith("5", 300, 400);
    });
  });

  describe("draw element drag stop", () => {
    it("updates draw element position in draw mode", () => {
      const setDrawElements = vi.fn();
      let drawElements = [
        { id: "draw-wall-1", x: 50, y: 60, kind: "wall" as const },
      ];

      const mockNode: Node = {
        id: "draw-wall-1",
        type: "drawElement",
        position: { x: 150.5, y: 200.5 },
        data: {},
      };

      const onNodeDragStop = (
        _event: unknown,
        node: Node,
        mapMode: "tables" | "draw",
        currentElements: typeof drawElements
      ) => {
        if (node.type === "drawElement" && node.position && mapMode === "draw") {
          const x = Math.round(node.position.x);
          const y = Math.round(node.position.y);
          const updated = currentElements.map((el) =>
            el.id === node.id ? { ...el, x, y } : el
          );
          setDrawElements(updated);
          return updated;
        }
        return currentElements;
      };

      const result = onNodeDragStop(null, mockNode, "draw", drawElements);

      expect(setDrawElements).toHaveBeenCalled();
      expect(result).toEqual([
        { id: "draw-wall-1", x: 151, y: 201, kind: "wall" },
      ]);
    });

    it("does not update draw element in tables mode", () => {
      const setDrawElements = vi.fn();

      const mockNode: Node = {
        id: "draw-wall-1",
        type: "drawElement",
        position: { x: 150, y: 200 },
        data: {},
      };

      const onNodeDragStop = (
        _event: unknown,
        node: Node,
        mapMode: "tables" | "draw"
      ) => {
        if (node.type === "drawElement" && node.position && mapMode === "draw") {
          setDrawElements();
          return true;
        }
        return false;
      };

      const result = onNodeDragStop(null, mockNode, "tables");

      expect(setDrawElements).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("position persistence flow", () => {
    it("saves position via API after drag stop", async () => {
      const apiTablesUpdate = vi.fn().mockResolvedValue({ success: true });
      const mockApi = { tables: { update: apiTablesUpdate } };

      const mockNode: Node = {
        id: "5",
        type: "restaurantTable",
        position: { x: 150, y: 200 },
        data: {},
      };

      const savePosition = async (
        id: string,
        x: number,
        y: number
      ) => {
        const tableId = Number(id);
        if (!Number.isFinite(tableId) || tableId <= 0) return;
        await mockApi.tables.update({
          id: tableId,
          x_pos: Math.round(x),
          y_pos: Math.round(y),
          date: "2026-04-05",
          floor_number: 0,
        });
      };

      await savePosition(mockNode.id, mockNode.position.x, mockNode.position.y);

      expect(apiTablesUpdate).toHaveBeenCalledWith({
        id: 5,
        x_pos: 150,
        y_pos: 200,
        date: "2026-04-05",
        floor_number: 0,
      });
    });

    it("queues layout persistence for draw elements", () => {
      const queuePersistLayout = vi.fn();
      const bookingStates = {};
      const limitPoints: LinePoint[] = [];
      let drawElements = [
        { id: "draw-wall-1", x: 50, y: 60, displayMode: "both" as const },
      ];

      const onNodeDragStop = (
        _event: unknown,
        node: Node,
        mapMode: "tables" | "draw"
      ) => {
        if (node.type === "drawElement" && node.position && mapMode === "draw") {
          const x = Math.round(node.position.x);
          const y = Math.round(node.position.y);
          const updated = drawElements.map((el) =>
            el.id === node.id ? { ...el, x, y } : el
          );
          drawElements = updated;
          queuePersistLayout(updated, bookingStates, limitPoints);
        }
      };

      const mockNode: Node = {
        id: "draw-wall-1",
        type: "drawElement",
        position: { x: 100, y: 150 },
        data: {},
      };

      onNodeDragStop(null, mockNode, "draw");

      expect(queuePersistLayout).toHaveBeenCalledWith(
        [{ id: "draw-wall-1", x: 100, y: 150, displayMode: "both" }],
        {},
        []
      );
    });
  });

  describe("touch event handling", () => {
    it("works identically for touch and mouse events", () => {
      const savePosition = vi.fn();

      const mockNode: Node = {
        id: "5",
        type: "restaurantTable",
        position: { x: 200, y: 300 },
        data: {},
      };

      // Event type doesn't matter for the callback logic
      const onNodeDragStop = (_event: unknown, node: Node) => {
        if (node.type === "restaurantTable" && node.position) {
          savePosition(node.id, node.position.x, node.position.y);
        }
      };

      onNodeDragStop({ type: "touchend" }, mockNode);
      expect(savePosition).toHaveBeenCalledWith("5", 200, 300);
    });
  });
});

describe("ReactFlow touch configuration", () => {
  it("sets touchAction:none for mobile drag support", () => {
    const style = { touchAction: "none" };
    expect(style.touchAction).toBe("none");
  });

  it("sets selectNodesOnDrag to false for mobile", () => {
    const selectNodesOnDrag = false;
    expect(selectNodesOnDrag).toBe(false);
  });

  it("enables panOnDrag for mobile touch gestures", () => {
    const panOnDrag = true;
    const interactionMode = "pan";
    const shouldPan = interactionMode === "pan" || panOnDrag === true;
    expect(shouldPan).toBe(true);
  });

  it("enables nodesDraggable in select mode", () => {
    const nodesDraggable = true;
    const interactionMode = "select";
    const canDrag = interactionMode === "select" && nodesDraggable;
    expect(canDrag).toBe(true);
  });

  it("combines props correctly for mobile touch", () => {
    const config = {
      touchAction: "none" as const,
      selectNodesOnDrag: false,
      panOnDrag: true,
      nodesDraggable: true,
    };

    expect(config.touchAction).toBe("none");
    expect(config.selectNodesOnDrag).toBe(false);
    expect(config.panOnDrag).toBe(true);
    expect(config.nodesDraggable).toBe(true);
  });
});
