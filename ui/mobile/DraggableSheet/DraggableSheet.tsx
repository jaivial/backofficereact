import React, { useRef, useState } from "react";
import { cn } from "../../shadcn/utils";

/*
 * Non-modal bottom sheet (draggable_sheet_v1): the page behind stays usable.
 * The handle in its header resizes it: drag up to grow, drag down to shrink,
 * below the close threshold it closes; a plain tap toggles small / tall.
 * Its body keeps clear of the app bottom navbar (76px + safe area).
 */

type Props = {
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  children: React.ReactNode;
  label: string;
  testId: string;
  className?: string;
};

const MIN = 0.25;
const MAX = 0.9;
const TALL = 0.8;
const INITIAL = 0.45;
const CLOSE_AT = 0.18;

export function DraggableSheet({ open, onClose, header, children, label, testId, className }: Props) {
  const [height, setHeight] = useState(INITIAL);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  if (!open) return null;

  const vh = () => window.visualViewport?.height ?? window.innerHeight;
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: height, moved: false };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setHeight(Math.min(MAX, Math.max(0.05, d.h + dy / vh())));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) return setHeight(height < TALL ? TALL : INITIAL);
    if (height < CLOSE_AT) {
      setHeight(INITIAL);
      onClose();
    } else if (height < MIN) setHeight(MIN);
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[170] flex flex-col rounded-t-2xl border-t border-bo-border bg-bo-shell shadow-[0_-12px_40px_rgba(0,0,0,0.45)]",
        !dragging && "transition-[height] duration-200",
        className,
      )}
      style={{ height: `${height * 100}dvh` }}
      data-testid={testId}
      data-observe="draggable_sheet_v1"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Arrastra para cambiar el tamaño o cerrar"
        className="flex shrink-0 cursor-grab touch-none justify-center pb-1.5 pt-2.5 active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-testid={`${testId}-handle`}
      >
        <span className="h-1.5 w-11 rounded-full bg-zinc-800 dark:bg-[#f8f6f0]" aria-hidden="true" data-testid={`${testId}-handle-bar`} />
      </div>
      {header && <div className="shrink-0" data-testid={`${testId}-header`}>{header}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom,0px)+24px)]" data-testid={`${testId}-body`}>{children}</div>
    </section>
  );
}
