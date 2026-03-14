import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type MenuItem = {
  id: string;
  label: string;
  tone?: "default" | "danger";
  icon?: React.ReactNode;
  onSelect: () => void;
};

type MenuDirection = "up" | "down";

type Pos = {
  top: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  direction: MenuDirection;
  ready: boolean;
};

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 8;

function portalEl(): HTMLElement | null {
  return document.getElementById("portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function baseMetrics(triggerEl: HTMLButtonElement, menuMinWidthPx?: number) {
  const rect = triggerEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.max(vw - VIEWPORT_MARGIN * 2, 1);
  const minWidth = Math.min(Math.max(typeof menuMinWidthPx === "number" ? menuMinWidthPx : 160, rect.width), maxWidth);
  const spaceBelow = Math.max(vh - rect.bottom - VIEWPORT_MARGIN - MENU_GAP, 1);
  const spaceAbove = Math.max(rect.top - VIEWPORT_MARGIN - MENU_GAP, 1);
  return { rect, vw, vh, maxWidth, minWidth, spaceBelow, spaceAbove };
}

function initialPos(triggerEl: HTMLButtonElement, menuMinWidthPx?: number): Pos {
  const { rect, vw, vh, maxWidth, minWidth, spaceBelow, spaceAbove } = baseMetrics(triggerEl, menuMinWidthPx);
  const direction: MenuDirection = spaceBelow >= spaceAbove ? "down" : "up";
  const left = clamp(rect.left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - minWidth - VIEWPORT_MARGIN));
  const top =
    direction === "down"
      ? clamp(rect.bottom + MENU_GAP, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN))
      : clamp(rect.top - MENU_GAP, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN));

  return {
    top,
    left,
    minWidth,
    maxWidth,
    maxHeight: direction === "down" ? spaceBelow : spaceAbove,
    direction,
    ready: false,
  };
}

function measuredPos(triggerEl: HTMLButtonElement, menuEl: HTMLDivElement, menuMinWidthPx?: number): Pos {
  const { rect, vw, vh, maxWidth, minWidth, spaceBelow, spaceAbove } = baseMetrics(triggerEl, menuMinWidthPx);
  const menuWidth = Math.min(maxWidth, Math.max(minWidth, menuEl.offsetWidth));
  const menuHeight = Math.max(menuEl.scrollHeight, menuEl.offsetHeight, 1);
  const left = clamp(rect.left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - menuWidth - VIEWPORT_MARGIN));

  let direction: MenuDirection = "down";
  if (menuHeight <= spaceBelow) direction = "down";
  else if (menuHeight <= spaceAbove) direction = "up";
  else direction = spaceBelow >= spaceAbove ? "down" : "up";

  const maxHeight = direction === "down" ? spaceBelow : spaceAbove;
  const renderedHeight = Math.min(menuHeight, maxHeight);
  const rawTop = direction === "down" ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - renderedHeight;
  const top = clamp(rawTop, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - renderedHeight - VIEWPORT_MARGIN));

  return {
    top,
    left,
    minWidth,
    maxWidth,
    maxHeight,
    direction,
    ready: true,
  };
}

function samePos(a: Pos | null, b: Pos): boolean {
  return Boolean(
    a &&
      a.top === b.top &&
      a.left === b.left &&
      a.minWidth === b.minWidth &&
      a.maxWidth === b.maxWidth &&
      a.maxHeight === b.maxHeight &&
      a.direction === b.direction &&
      a.ready === b.ready,
  );
}

export function DropdownMenu({
  label,
  items,
  triggerContent,
  triggerClassName,
  menuMinWidthPx,
}: {
  label: string;
  items: MenuItem[];
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  menuMinWidthPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const reduceMotion = useReducedMotion();

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const openMenu = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    setPos(initialPos(triggerEl, menuMinWidthPx));
    setOpen(true);
  }, [menuMinWidthPx]);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    openMenu();
  }, [close, open, openMenu]);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;
    const nextPos = measuredPos(triggerEl, menuEl, menuMinWidthPx);
    setPos((current) => (samePos(current, nextPos) ? current : nextPos));
  }, [menuMinWidthPx]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open || !pos?.ready) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button[data-menuitem]");
    first?.focus();
  }, [open, pos?.ready]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={triggerClassName || "w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] text-muted flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.12] hover:-translate-y-0.5"}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      onClick={toggle}
    >
      {triggerContent || <MoreVertical size={18} strokeWidth={1.8} />}
    </button>
  );

  const menu = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={menuRef}
          className="absolute z-50 mt-1 p-1 rounded-lg border border-white/[0.06] bg-card shadow-lg min-w-[180px]"
          role="menu"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: pos.direction === "up" ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: pos.direction === "up" ? -6 : 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeInOut" }}
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: pos.minWidth,
            maxWidth: pos.maxWidth,
            maxHeight: pos.maxHeight,
            overflowY: "auto",
            overscrollBehavior: "contain",
            transformOrigin: pos.direction === "up" ? "bottom left" : "top left",
            visibility: pos.ready ? "visible" : "hidden",
          }}
        >
          {items.map((it) => (
            <button
              key={it.id}
              data-menuitem
              type="button"
              className={`w-full px-3 py-2 rounded-md text-sm text-left flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06] cursor-pointer ${it.tone === "danger" ? "text-danger hover:bg-danger/10" : "text-foreground"}`}
              role="menuitem"
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.icon ? <span className="text-muted w-4 h-4 flex-shrink-0" aria-hidden="true">{it.icon}</span> : null}
              <span>{it.label}</span>
            </button>
          ))}
        </motion.div>,
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
