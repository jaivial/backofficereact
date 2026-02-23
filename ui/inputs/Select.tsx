import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { value: string; label: string; icon?: React.ReactNode };
type Pos = { top: number; left: number; width: number; maxHeight: number; direction: "up" | "down" };

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function Select({
  value,
  onChange,
  options,
  size,
  ariaLabel,
  className,
  style,
  disabled,
  listMaxHeightPx,
  menuMinWidthPx,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  listMaxHeightPx?: number;
  menuMinWidthPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const selected = useMemo(() => options.find((o) => o.value === value) || options[0], [options, value]);
  const btnClass = size === "sm" ? "bo-selectBtn bo-selectBtn--sm" : "bo-selectBtn";

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewportPadding = 8;
    const gap = 8;
    const minWidth = typeof menuMinWidthPx === "number" ? menuMinWidthPx : 180;
    const width = Math.max(minWidth, r.width);
    const left = clamp(r.left, viewportPadding, vw - width - viewportPadding);

    const availableBelow = Math.max(0, vh - r.bottom - gap - viewportPadding);
    const availableAbove = Math.max(0, r.top - gap - viewportPadding);
    const defaultDesiredHeight = typeof listMaxHeightPx === "number"
      ? listMaxHeightPx
      : Math.min(320, options.length * 44 + 12);
    const minimumOpenHeight = Math.min(160, defaultDesiredHeight);
    const shouldOpenUp = availableBelow < minimumOpenHeight && availableAbove > availableBelow;
    const availableForDirection = shouldOpenUp ? availableAbove : availableBelow;
    const maxHeight = Math.max(120, Math.min(defaultDesiredHeight, availableForDirection));
    const top = shouldOpenUp
      ? clamp(r.top - gap - maxHeight, viewportPadding, vh - maxHeight - viewportPadding)
      : clamp(r.bottom + gap, viewportPadding, vh - maxHeight - viewportPadding);

    setPos({
      top,
      left,
      width,
      maxHeight,
      direction: shouldOpenUp ? "up" : "down",
    });
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIdx(idx);
  }, [listMaxHeightPx, menuMinWidthPx, open, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const onBtnKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (disabled) return;
      if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setOpen(true);
      }
    },
    [disabled],
  );

  const onListKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        const opt = options[activeIdx];
        if (opt) onChange(opt.value);
        close();
        btnRef.current?.focus();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        close();
        btnRef.current?.focus();
      }
    },
    [activeIdx, close, onChange, options],
  );

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-opt="${activeIdx}"]`);
    el?.focus();
  }, [activeIdx, open]);

  const list = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={listRef}
          className="bo-selectList"
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: pos.direction === "up" ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: pos.direction === "up" ? -6 : 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: `${pos.maxHeight}px`,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {options.map((o, idx) => {
            const isSel = o.value === value;
            const isAct = idx === activeIdx;
            return (
              <button
                key={o.value}
                type="button"
                className={`bo-selectItem${isSel ? " is-selected" : ""}${isAct ? " is-active" : ""}`}
                role="option"
                aria-selected={isSel}
                tabIndex={idx === activeIdx ? 0 : -1}
                data-opt={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(o.value);
                  close();
                  btnRef.current?.focus();
                }}
              >
                {o.icon ? (
                  <span className="bo-selectItemIcon" aria-hidden="true">
                    {o.icon}
                  </span>
                ) : null}
                <span>{o.label}</span>
              </button>
            );
          })}
        </motion.div>,
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        className={[btnClass, className].filter(Boolean).join(" ")}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={style}
        onClick={toggle}
        onKeyDown={onBtnKey}
      >
        <span className="bo-selectLabelWrap">
          {selected?.icon ? (
            <span className="bo-selectIcon" aria-hidden="true">
              {selected.icon}
            </span>
          ) : null}
          <span className="bo-selectLabel">{selected?.label ?? ""}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.8} className="bo-selectChev" aria-hidden="true" />
      </button>
      {list}
    </>
  );
}
