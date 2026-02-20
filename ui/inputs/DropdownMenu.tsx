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

type Pos = { top: number; left: number; minWidth: number };

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const top = r.bottom + 8;
    const minWidth = Math.max(typeof menuMinWidthPx === "number" ? menuMinWidthPx : 160, r.width);
    const left = clamp(r.left, 8, vw - minWidth - 8);
    setPos({ top, left, minWidth });
  }, [menuMinWidthPx, open]);

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
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button[data-menuitem]");
    first?.focus();
  }, [open]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={triggerClassName || "bo-actionBtn"}
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
          className="bo-menu"
          role="menu"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
        >
          {items.map((it) => (
            <button
              key={it.id}
              data-menuitem
              type="button"
              className={`bo-menuItem${it.tone === "danger" ? " is-danger" : ""}`}
              role="menuitem"
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.icon ? <span className="bo-menuIcon" aria-hidden="true">{it.icon}</span> : null}
              <span className="bo-menuLabel">{it.label}</span>
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
