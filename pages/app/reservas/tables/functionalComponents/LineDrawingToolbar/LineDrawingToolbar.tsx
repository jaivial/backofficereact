import React from "react";
import { Circle, SquareMinus, Undo } from "lucide-react";

type LineDrawingToolbarProps = {
  /** Number of points currently placed */
  pointCount: number;
  /** Whether the user is actively drawing (placing points) */
  isDrawing: boolean;
  /** Close the area polygon (needs >= 3 points) */
  onCloseArea: () => void;
  /** Undo last placed point */
  onUndoPoint: () => void;
  /** Cancel the entire drawing */
  onCancel: () => void;
};

export function LineDrawingToolbar({
  pointCount,
  isDrawing,
  onCloseArea,
  onUndoPoint,
  onCancel,
}: LineDrawingToolbarProps) {
  if (!isDrawing) return null;

  return (
    <div data-ui="line-drawing-toolbar" className="bo-lineDrawingToolbar">
      <div data-slot="toolbar-status" className="bo-lineDrawingToolbarStatus">
        <Circle size={10} className="bo-lineDrawingToolbarDot" data-ui="status-dot" />
        <span data-ui="point-counter">{pointCount} puntos</span>
      </div>
      <div data-slot="toolbar-actions" className="bo-lineDrawingToolbarActions">
        {pointCount > 0 && (
          <button
            data-ui="toolbar-undo-btn"
            className="bo-btn bo-btn--ghost bo-btn--sm"
            type="button"
            onClick={onUndoPoint}
          >
            <Undo size={14}>
            Deshacer
          </button>
        )}
        {pointCount >= 3 && (
          <button
            data-ui="toolbar-close-area-btn"
            className="bo-btn bo-btn--primary bo-btn--sm"
            type="button"
            onClick={onCloseArea}
          >
            <SquareMinus size={14}>
            Cerrar area
          </button>
        )}
        <button
          data-ui="toolbar-cancel-btn"
          className="bo-btn bo-btn--ghost bo-btn--sm"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
