import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "../shadcn/utils";
import { calculatePopoverPosition } from "../inputs/hooks/usePopoverPosition";

// A generic anchored overlay.
//
// Single responsibility: position itself next to an anchor and close when the
// user dismisses it. It knows nothing about what it contains, so search
// pickers, allergen grids and image choosers can all reuse it. Appearance is
// open for extension through `className`/`style` without modifying this file.

export type PopoverProps = {
  open: boolean;
  /** The element the popover is positioned against. */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Names the dialog for assistive tech; required because it has no visible title of its own. */
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Fixed width. Leave unset and give min/max instead to size to the content. */
  widthPx?: number;
  /** Lower bound when sizing to content, so a one-word panel is not a sliver. */
  minWidthPx?: number;
  /** Upper bound when sizing to content; the viewport still wins over it. */
  maxWidthPx?: number;
  "data-role"?: string;
  "data-testid"?: string;
};

const VIEWPORT_MARGIN = 8;
const DEFAULT_WIDTH = 320;

export function Popover({
  open,
  anchorRef,
  onClose,
  ariaLabel,
  children,
  className,
  style,
  widthPx,
  minWidthPx,
  maxWidthPx,
  "data-role": dataRole,
  "data-testid": dataTestId,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const { pos: next } = calculatePopoverPosition(
      anchor,
      panelRef.current,
      widthPx ?? maxWidthPx ?? minWidthPx ?? DEFAULT_WIDTH,
      panelRef.current?.offsetHeight ?? 280,
      VIEWPORT_MARGIN,
    );
    setPos(next);
  }, [anchorRef, maxWidthPx, minWidthPx, widthPx]);

  // Measured after paint so the real panel height is used, not the estimate.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // A click on the anchor is the anchor's business (usually a toggle), so
      // closing here too would immediately reopen or fight it.
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", reposition);
    // Capture phase: a scroll inside any ancestor still moves the anchor.
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorRef, onClose, open, reposition]);

  const dynamic = widthPx == null && (minWidthPx != null || maxWidthPx != null);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cn("bo-popover", dynamic && "bo-popover--auto", className)}
      role="dialog"
      aria-label={ariaLabel}
      data-role={dataRole}
      data-testid={dataTestId}
      style={{
        // Until the first measurement the panel is hidden rather than flashing
        // at the top-left corner of the screen.
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        // With bounds the panel sizes to its content; without them it keeps the
        // old fixed width. A fixed width would pad a short result list out to
        // the full size and clip a long one.
        ...(dynamic
          ? {
              width: "max-content",
              minWidth: minWidthPx,
              // Passed as a custom property so the stylesheet can clamp it
              // against the viewport with min(): React drops an inline min()
              // value it cannot parse, and the panel would lose its cap.
              ["--bo-popover-max" as string]: `${maxWidthPx ?? DEFAULT_WIDTH}px`,
            }
          : { width: widthPx ?? DEFAULT_WIDTH }),
        visibility: pos ? "visible" : "hidden",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
