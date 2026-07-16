import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../shadcn/utils";

const MIN_THUMB_SIZE = 28;

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  dataSlot?: string;
  maxHeight?: number | string;
}

export function ScrollArea({
  children,
  className,
  style,
  dataSlot = "scroll-area",
  maxHeight,
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const { scrollTop, scrollHeight, clientHeight } = vp;
    if (!scrollHeight || !clientHeight) return;
    const ratio = clientHeight / scrollHeight;

    if (ratio >= 1) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const computedH = Math.max(Math.round(ratio * clientHeight), MIN_THUMB_SIZE);
    setThumbHeight(computedH);
    const maxTop = clientHeight - computedH;
    setThumbTop(Math.min(Math.round((scrollTop / scrollHeight) * clientHeight), maxTop));
  }, []);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    update();
    vp.addEventListener("scroll", update, { passive: true });

    const ro = new ResizeObserver(() => update());
    ro.observe(vp);

    return () => {
      vp.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const vp = viewportRef.current;
      if (!vp) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = y / rect.height;
      vp.scrollTop = ratio * vp.scrollHeight - vp.clientHeight / 2;
    },
    [],
  );

  const handleThumbPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      setDragging(true);

      const vp = viewportRef.current;
      if (!vp) return;

      const startY = e.clientY;
      const startScrollTop = vp.scrollTop;
      const startClientHeight = vp.clientHeight;
      const startScrollHeight = vp.scrollHeight;

      const onMove = (ev: PointerEvent) => {
        const deltaY = ev.clientY - startY;
        const ratio = deltaY / startClientHeight;
        vp.scrollTop = startScrollTop + ratio * startScrollHeight;
      };

      const onUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        setDragging(false);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [],
  );

  const resolvedMaxHeight =
    maxHeight != null
      ? typeof maxHeight === "number"
        ? `${maxHeight}px`
        : maxHeight
      : undefined;

  return (
    <div
      className={cn("bo-scrollArea relative flex h-full overflow-hidden", className)}
      style={{
        ...style,
        ...(resolvedMaxHeight ? { maxHeight: resolvedMaxHeight } : {}),
      }}
      data-slot={dataSlot}
    >
      <div
        ref={viewportRef}
        className="bo-scrollAreaViewport h-full w-full overflow-auto overscroll-contain"
        style={resolvedMaxHeight ? { maxHeight: resolvedMaxHeight } : undefined}
        data-slot="scroll-area-viewport"
      >
        {children}
      </div>

      {visible && (
        <div
          className="bo-scrollBar absolute right-0 top-0 z-10 h-full cursor-pointer opacity-60 hover:opacity-100"
          data-slot="scroll-area-bar"
          onPointerDown={handleTrackClick}
        >
          <div
            ref={thumbRef}
            className={cn(
              "bo-scrollThumb",
              dragging && "is-dragging",
            )}
            data-slot="scroll-area-thumb"
            style={{
              height: thumbHeight,
              transform: `translateY(${thumbTop}px)`,
            }}
            onPointerDown={handleThumbPointerDown}
          />
        </div>
      )}
    </div>
  );
}
